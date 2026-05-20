import type { ApolloCache } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../features/auth';
import {
  DEFAULT_EXPENSE_CATEGORY,
  GET_EXPENSES,
  buildExpenseCategoryOptions,
  buildMerchantSuggestions,
  expenseCategoryExtrasFromWorkspace,
  useExpenseActions,
  type GetExpensesResponse,
  type SplitAllocationInput,
} from '../../features/expenses';
import { useUserWorkspaceSettings } from '../../features/userSettings';
import {
  CREATE_GROUP,
  DECLINE_EXPENSE_GROUP_PARTICIPATION,
  DELETE_EXPENSE_GROUP,
  GET_GROUPS,
  GET_GROUP_SPLIT_TEMPLATES,
  mergeGroupIntoCache,
  UPDATE_GROUP,
  UPSERT_GROUP_SPLIT_TEMPLATE,
  type GetGroupSplitTemplatesQueryResult,
  type GetGroupsQueryResult,
  type GroupMember,
  type GroupSummary,
  type SplitTemplate,
} from '../../features/groups';
import type {
  CreateGroupMutation,
  DeleteExpenseGroupMutation,
  UpdateGroupMutation,
} from '../../graphql/generated/graphql';
import { APP_CURRENCY_CODE } from '../../format/currency';


type DraftExpenseGroup = {
  category: string;
  customCategory: string;
};

type TemplateSplitMode = 'equal' | 'ratio_50_50' | 'ratio_60_40' | 'ratio_70_30' | 'custom';

const DEFAULT_MEMBERS: GroupMember[] = [
  { userId: null, name: 'You', email: 'you@example.com', ratio: 0 },
  { userId: null, name: '', email: '', ratio: 0 },
];

const PREDEFINED_EXPENSE_GROUPS = ['Groceries', 'Utilities', 'Rent', 'Entertainment', 'Internet', 'Transport'];

const getInitialMembers = (): GroupMember[] => {
  return DEFAULT_MEMBERS.map((member) => ({ ...member }));
};

const withEvenRatios = (inputMembers: GroupMember[]): GroupMember[] => {
  const memberCount = inputMembers.length;
  if (!memberCount) {
    return [];
  }
  const baseRatio = Number((100 / memberCount).toFixed(2));
  return inputMembers.map((member, index) => {
    if (index === memberCount - 1) {
      const allocated = baseRatio * (memberCount - 1);
      return { ...member, ratio: Number((100 - allocated).toFixed(2)) };
    }
    return { ...member, ratio: baseRatio };
  });
};

/** Shows every household expense regardless of expense-group tab. */
export const ALL_HOUSEHOLD_EXPENSE_GROUPS = '__all__';

const currentYearMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const useHouseholdPageState = () => {
  const { user } = useAuth();
  const { settings: workspaceSettings } = useUserWorkspaceSettings(user?.id ?? '', currentYearMonthKey());
  const { data, loading, error } = useQuery<GetGroupsQueryResult>(GET_GROUPS);
  const { data: expensesData } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { addExpense, isMutating: isCreatingExpense } = useExpenseActions();
  const [createGroupMutation, { loading: creatingGroup }] = useMutation<CreateGroupMutation>(CREATE_GROUP, {
    update(cache, { data }) {
      mergeGroupIntoCache(cache, data?.createGroup ?? null);
    },
  });
  const [updateGroupMutation, { loading: updatingGroup }] = useMutation<UpdateGroupMutation>(UPDATE_GROUP, {
    update(cache, { data }) {
      mergeGroupIntoCache(cache, data?.updateGroup ?? null);
    },
  });
  const mergeGroupFromMutation = useCallback((cache: ApolloCache, result: { data?: unknown }) => {
    if (!result.data || typeof result.data !== 'object') {
      return;
    }
    const record = result.data as Record<string, GroupSummary | undefined>;
    const group =
      record.upsertGroupSplitTemplate ??
      record.declineExpenseGroupParticipation ??
      record.deleteExpenseGroup;
    mergeGroupIntoCache(cache, group);
  }, []);

  const [upsertTemplateMutation, { loading: savingTemplate }] = useMutation(UPSERT_GROUP_SPLIT_TEMPLATE, {
    update: mergeGroupFromMutation,
  });
  const [declineExpenseGroupMutation, { loading: isDecliningExpenseGroup }] = useMutation(
    DECLINE_EXPENSE_GROUP_PARTICIPATION,
    {
      update: mergeGroupFromMutation,
    },
  );
  const [deleteExpenseGroupMutation, { loading: isDeletingExpenseGroup }] = useMutation<DeleteExpenseGroupMutation>(
    DELETE_EXPENSE_GROUP,
    {
      update: mergeGroupFromMutation,
    },
  );
  const groups = useMemo(() => data?.groups ?? [], [data?.groups]);
  const [activeGroupId, setActiveGroupId] = useState('');
  const [isModalOpen, setModalOpen] = useState(false);
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [editingHouseholdId, setEditingHouseholdId] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>(() => getInitialMembers());
  const [formError, setFormError] = useState<string | null>(null);
  const [createExpenseGroupsOnHouseholdCreate, setCreateExpenseGroupsOnHouseholdCreate] = useState(false);
  const [householdExpenseGroups, setHouseholdExpenseGroups] = useState<DraftExpenseGroup[]>([]);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseGroup, setExpenseGroup] = useState('Groceries');
  const [expenseCategory, setExpenseCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [expenseMembers, setExpenseMembers] = useState<Array<{ name: string; selected: boolean; ratio: number }>>([]);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState(PREDEFINED_EXPENSE_GROUPS[0]);
  const [customTemplateCategory, setCustomTemplateCategory] = useState('');
  const [editingTemplateCategory, setEditingTemplateCategory] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSuccessMessage, setTemplateSuccessMessage] = useState<string | null>(null);
  const [templateMembers, setTemplateMembers] = useState<Array<{ name: string; selected: boolean; ratio: string }>>(
    [],
  );
  const [templateSplitMode, setTemplateSplitMode] = useState<TemplateSplitMode>('equal');
  const [activeExpenseGroupCategory, setActiveExpenseGroupCategory] = useState(ALL_HOUSEHOLD_EXPENSE_GROUPS);

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0],
    [activeGroupId, groups],
  );
  const sharedHouseholdExpenses = useMemo(
    () => activeGroup?.expenses ?? [],
    [activeGroup],
  );
  const { data: templatesData, refetch: refetchGroupTemplates } = useQuery<GetGroupSplitTemplatesQueryResult>(
    GET_GROUP_SPLIT_TEMPLATES,
    {
      variables: { groupId: activeGroup?.id ?? '' },
      skip: !activeGroup?.id,
    },
  );
  const splitTemplates = useMemo(() => templatesData?.groupSplitTemplates ?? [], [templatesData?.groupSplitTemplates]);
  const normalizedTemplateCategory = templateCategory === '__custom__' ? customTemplateCategory.trim() : templateCategory;
  const existingTemplateForSelectedCategory = useMemo(
    () =>
      splitTemplates.find(
        (template) => template.category.trim().toLowerCase() === normalizedTemplateCategory.trim().toLowerCase(),
      ),
    [normalizedTemplateCategory, splitTemplates],
  );
  const expenseGroupOptions = useMemo(() => {
    const merged = [...splitTemplates.map((template) => template.category), ...PREDEFINED_EXPENSE_GROUPS];
    return Array.from(new Set(merged.map((item) => item.trim()).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [splitTemplates]);
  const sortedExpenseCategories = useMemo(
    () =>
      buildExpenseCategoryOptions(
        expensesData?.expenses ?? [],
        expenseCategoryExtrasFromWorkspace(workspaceSettings),
      ),
    [expensesData?.expenses, workspaceSettings],
  );
  const createTemplateCategoryOptions = useMemo(() => {
    const existing = new Set(splitTemplates.map((template) => template.category.trim().toLowerCase()));
    return PREDEFINED_EXPENSE_GROUPS.filter((category) => !existing.has(category.trim().toLowerCase()));
  }, [splitTemplates]);
  const selectedTemplateMembersCount = useMemo(
    () => templateMembers.filter((member) => member.selected).length,
    [templateMembers],
  );
  const isTemplateCategoryValid = normalizedTemplateCategory.length > 0;
  const selectedTemplateMembers = useMemo(
    () => templateMembers.filter((member) => member.selected),
    [templateMembers],
  );
  const areSelectedTemplateRatiosValid = useMemo(() => {
    if (selectedTemplateMembers.length < 2) {
      return false;
    }
    const parsed = selectedTemplateMembers.map((member) => Number(member.ratio));
    if (parsed.some((ratio) => !Number.isFinite(ratio) || ratio <= 0)) {
      return false;
    }
    const total = parsed.reduce((sum, ratio) => sum + ratio, 0);
    return Math.abs(total - 100) <= 0.01;
  }, [selectedTemplateMembers]);
  const isTemplateSubmitDisabled = savingTemplate || !isTemplateCategoryValid || !areSelectedTemplateRatiosValid;
  const isViewingAllExpenseGroups = activeExpenseGroupCategory === ALL_HOUSEHOLD_EXPENSE_GROUPS;
  const activeExpenseGroup = useMemo(() => {
    if (isViewingAllExpenseGroups) {
      return null;
    }
    return (
      splitTemplates.find((template) => template.category === activeExpenseGroupCategory) ?? splitTemplates[0] ?? null
    );
  }, [activeExpenseGroupCategory, isViewingAllExpenseGroups, splitTemplates]);
  const activeExpenseGroupExpenses = useMemo(() => {
    if (!activeGroup) {
      return [];
    }
    if (isViewingAllExpenseGroups) {
      return sharedHouseholdExpenses;
    }
    if (!activeExpenseGroup) {
      return sharedHouseholdExpenses;
    }
    return sharedHouseholdExpenses.filter(
      (expense) =>
        (expense.expenseGroup ?? expense.category).trim().toLowerCase() ===
        activeExpenseGroup.category.trim().toLowerCase(),
    );
  }, [activeExpenseGroup, activeGroup, isViewingAllExpenseGroups, sharedHouseholdExpenses]);
  const expenseCountByGroupCategory = useMemo(() => {
    const counts = new Map<string, number>();
    if (!activeGroup) {
      return counts;
    }
    for (const expense of sharedHouseholdExpenses) {
      const key = (expense.expenseGroup ?? expense.category).trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [activeGroup, sharedHouseholdExpenses]);
  const activeExpenseGroupTotals = useMemo(
    () =>
      activeExpenseGroupExpenses.reduce(
        (acc, expense) => ({
          total: Number((acc.total + expense.total).toFixed(2)),
          yourShare: Number((acc.yourShare + expense.yourShare).toFixed(2)),
        }),
        { total: 0, yourShare: 0 },
      ),
    [activeExpenseGroupExpenses],
  );
  const selectedExpenseTemplate = useMemo(
    () =>
      splitTemplates.find(
        (template) => template.category.trim().toLowerCase() === expenseGroup.trim().toLowerCase(),
      ) ?? null,
    [expenseGroup, splitTemplates],
  );
  const merchantCategoryLookup = useMemo(() => {
    const allExpenses = expensesData?.expenses ?? [];
    return buildMerchantSuggestions(allExpenses);
  }, [expensesData?.expenses]);
  const merchantOptions = useMemo(
    () => Array.from(merchantCategoryLookup.values()).map((entry) => entry.merchant),
    [merchantCategoryLookup],
  );
  const isExpenseBaseValid = useMemo(() => {
    const amount = Number(expenseAmount);
    return (
      expenseTitle.trim().length > 0 &&
      expenseDate.trim().length > 0 &&
      expenseGroup.trim().length > 0 &&
      expenseCategory.trim().length > 0 &&
      Number.isFinite(amount) &&
      amount > 0
    );
  }, [expenseAmount, expenseCategory, expenseDate, expenseGroup, expenseTitle]);
  const isExpenseSplitValid = useMemo(() => {
    if (selectedExpenseTemplate) {
      return true;
    }
    const selectedMembers = expenseMembers.filter((member) => member.selected);
    if (selectedMembers.length === 0) {
      return false;
    }
    const hasInvalidRatio = selectedMembers.some(
      (member) => !Number.isFinite(member.ratio) || member.ratio <= 0,
    );
    if (hasInvalidRatio) {
      return false;
    }
    const ratioTotal = selectedMembers.reduce((sum, member) => sum + member.ratio, 0);
    return Math.abs(ratioTotal - 100) <= 0.01;
  }, [expenseMembers, selectedExpenseTemplate]);
  const isExpenseSubmitDisabled = isCreatingExpense || !isExpenseBaseValid || !isExpenseSplitValid;

  useEffect(() => {
    if (!groups.length) {
      setActiveGroupId('');
      return;
    }

    const hasActiveGroup = groups.some((group) => group.id === activeGroupId);
    if (!hasActiveGroup) {
      setActiveGroupId(groups[0].id);
    }
  }, [activeGroupId, groups]);
  useEffect(() => {
    if (!splitTemplates.length) {
      setActiveExpenseGroupCategory(ALL_HOUSEHOLD_EXPENSE_GROUPS);
      return;
    }
    const hasActive =
      activeExpenseGroupCategory === ALL_HOUSEHOLD_EXPENSE_GROUPS ||
      splitTemplates.some((template) => template.category === activeExpenseGroupCategory);
    if (!hasActive) {
      setActiveExpenseGroupCategory(ALL_HOUSEHOLD_EXPENSE_GROUPS);
    }
  }, [activeExpenseGroupCategory, splitTemplates]);

  const resetCreateGroupForm = () => {
    setGroupName('');
    setDescription('');
    setEditingHouseholdId(null);
    setFormError(null);
    setMembers(getInitialMembers());
    setCreateExpenseGroupsOnHouseholdCreate(false);
    setHouseholdExpenseGroups([]);
  };

  useEffect(() => {
    if (!user) {
      return;
    }
    setMembers((currentMembers) => {
      if (!currentMembers.length) {
        return currentMembers;
      }
      const [firstMember, ...rest] = currentMembers;
      return [
        {
          ...firstMember,
          name: user.fullName,
          email: user.email,
        },
        ...rest,
      ];
    });
  }, [user]);

  const closeCreateModal = () => {
    setModalOpen(false);
    resetCreateGroupForm();
  };

  const openEditHouseholdModal = () => {
    if (!activeGroup) {
      return;
    }
    setEditingHouseholdId(activeGroup.id);
    setGroupName(activeGroup.name);
    setDescription(activeGroup.description ?? '');
    setMembers(activeGroup.members.map((member) => ({ ...member })));
    setCreateExpenseGroupsOnHouseholdCreate(false);
    setHouseholdExpenseGroups([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openAddExpenseModal = (preferredExpenseGroup?: string) => {
    if (!activeGroup) {
      return;
    }
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setExpenseGroup(preferredExpenseGroup ?? expenseGroupOptions[0] ?? 'Groceries');
    setExpenseCategory(DEFAULT_EXPENSE_CATEGORY);
    setExpenseError(null);
    setExpenseMembers(
      activeGroup.members.map((member) => ({
        name: member.name,
        selected: true,
        ratio: member.ratio,
      })),
    );
    setExpenseModalOpen(true);
  };

  useEffect(() => {
    if (!isExpenseModalOpen || !activeGroup) {
      return;
    }

    if (!selectedExpenseTemplate) {
      setExpenseMembers(
        activeGroup.members.map((member) => ({
          name: member.name,
          selected: true,
          ratio: member.ratio,
        })),
      );
      return;
    }

    const ratioByParticipant = new Map(
      selectedExpenseTemplate.splitDetails.map((allocation) => [
        allocation.participant.trim().toLowerCase(),
        allocation.ratio,
      ]),
    );
    setExpenseMembers(
      activeGroup.members.map((member) => {
        const ratio = ratioByParticipant.get(member.name.trim().toLowerCase());
        if (ratio === undefined) {
          return { name: member.name, selected: false, ratio: member.ratio };
        }
        return { name: member.name, selected: true, ratio };
      }),
    );
  }, [activeGroup, isExpenseModalOpen, selectedExpenseTemplate]);

  const closeExpenseModal = () => {
    setExpenseModalOpen(false);
    setExpenseError(null);
  };

  const openTemplateModal = () => {
    setTemplateSuccessMessage(null);
    if (!activeGroup) {
      return;
    }
    const existing = new Set(splitTemplates.map((template) => template.category.trim().toLowerCase()));
    const firstUnusedCategory =
      PREDEFINED_EXPENSE_GROUPS.find((category) => !existing.has(category.trim().toLowerCase())) ?? '__custom__';
    setTemplateError(null);
    setEditingTemplateCategory(null);
    setTemplateCategory(firstUnusedCategory);
    setCustomTemplateCategory('');
    setTemplateMembers(
      activeGroup.members.map((member) => ({
        name: member.name,
        selected: true,
        ratio: String(member.ratio),
      })),
    );
    setTemplateSplitMode('equal');
    setTemplateModalOpen(true);
  };

  const closeTemplateModal = () => {
    setTemplateModalOpen(false);
    setEditingTemplateCategory(null);
    setTemplateError(null);
    setTemplateSuccessMessage(null);
  };

  const openEditTemplateModal = (template: SplitTemplate) => {
    if (!activeGroup) {
      return;
    }
    setTemplateSuccessMessage(null);
    const ratioByParticipant = new Map(
      template.splitDetails.map((allocation) => [allocation.participant.trim().toLowerCase(), allocation.ratio]),
    );
    setEditingTemplateCategory(template.category);
    setTemplateCategory(template.category);
    setCustomTemplateCategory('');
    setTemplateMembers(
      activeGroup.members.map((member) => {
        const ratio = ratioByParticipant.get(member.name.trim().toLowerCase());
        return {
          name: member.name,
          selected: ratio !== undefined,
          ratio: ratio !== undefined ? String(ratio) : '',
        };
      }),
    );
    setTemplateSplitMode('custom');
    setTemplateError(null);
    setTemplateModalOpen(true);
  };

  const updateMember = (index: number, patch: Partial<GroupMember>) => {
    setMembers((previous) =>
      previous.map((member, memberIndex) => (memberIndex === index ? { ...member, ...patch } : member)),
    );
  };

  const applyEqualTemplateSplit = useCallback(() => {
    setTemplateMembers((previous) => {
      const selectedIndexes = previous
        .map((member, index) => (member.selected ? index : -1))
        .filter((index) => index >= 0);
      const selectedCount = selectedIndexes.length;
      if (selectedCount === 0) {
        return previous;
      }
      const baseRatio = Number((100 / selectedCount).toFixed(2));
      let changed = false;
      const next = previous.map((member, index) => {
        const selectedPosition = selectedIndexes.indexOf(index);
        if (selectedPosition === -1) {
          return member;
        }
        const ratio =
          selectedPosition === selectedCount - 1
            ? Number((100 - baseRatio * (selectedCount - 1)).toFixed(2))
            : baseRatio;
        const ratioString = String(ratio);
        if (member.ratio !== ratioString) {
          changed = true;
          return { ...member, ratio: ratioString };
        }
        return member;
      });
      return changed ? next : previous;
    });
  }, []);

  const applyTemplatePreset = useCallback((ratios: [number, number]) => {
    setTemplateMembers((previous) => {
      const selectedIndexes = previous
        .map((member, index) => (member.selected ? index : -1))
        .filter((index) => index >= 0);

      if (selectedIndexes.length !== 2) {
        setTemplateError('50/50, 60/40, and 70/30 presets work for exactly 2 selected members.');
        return previous;
      }

      setTemplateError(null);
      return previous.map((member, index) => {
        const selectedPosition = selectedIndexes.indexOf(index);
        if (selectedPosition === -1) {
          return member;
        }
        return {
          ...member,
          ratio: String(ratios[selectedPosition]),
        };
      });
    });
  }, []);

  const clearTemplateRatiosForCustom = () => {
    setTemplateError(null);
    setTemplateMembers((previous) =>
      previous.map((member) => (member.selected ? { ...member, ratio: '' } : member)),
    );
  };

  useEffect(() => {
    if (!isTemplateModalOpen) {
      return;
    }
    if (templateSplitMode === 'custom') {
      return;
    }
    if (templateSplitMode === 'equal') {
      applyEqualTemplateSplit();
      return;
    }
    if (templateSplitMode === 'ratio_50_50') {
      applyTemplatePreset([50, 50]);
      return;
    }
    if (templateSplitMode === 'ratio_60_40') {
      applyTemplatePreset([60, 40]);
      return;
    }
    applyTemplatePreset([70, 30]);
  }, [applyEqualTemplateSplit, applyTemplatePreset, isTemplateModalOpen, templateSplitMode, selectedTemplateMembersCount]);

  const onCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!groupName.trim()) {
      setFormError('Group name is required.');
      return;
    }

    const hasPartialMemberRows = members.some((member) => {
      const hasName = member.name.trim().length > 0;
      const hasEmail = member.email.trim().length > 0;
      return hasName !== hasEmail;
    });
    if (hasPartialMemberRows) {
      setFormError('Each member row must include both name and email.');
      return;
    }

    const validMembers = members.filter((member) => member.name.trim() && member.email.trim());
    if (validMembers.length < 2) {
      setFormError('Please provide at least two complete members.');
      return;
    }

    const duplicateEmails = new Set<string>();
    const hasDuplicateEmails = validMembers.some((member) => {
      const normalizedEmail = member.email.trim().toLowerCase();
      if (duplicateEmails.has(normalizedEmail)) {
        return true;
      }
      duplicateEmails.add(normalizedEmail);
      return false;
    });
    if (hasDuplicateEmails) {
      setFormError('Each group member must have a unique email.');
      return;
    }

    const membersWithRatios = withEvenRatios(validMembers);

    const expenseGroupCategories = !editingHouseholdId && createExpenseGroupsOnHouseholdCreate
      ? householdExpenseGroups
          .map((groupOption) =>
            groupOption.category === '__custom__' ? groupOption.customCategory.trim() : groupOption.category,
          )
          .filter((category) => category.length > 0)
      : [];
    if (!editingHouseholdId && createExpenseGroupsOnHouseholdCreate && expenseGroupCategories.length === 0) {
      setFormError('Add at least one expense group or disable that option.');
      return;
    }
    if (new Set(expenseGroupCategories.map((category) => category.toLowerCase())).size !== expenseGroupCategories.length) {
      setFormError('Expense group categories must be unique.');
      return;
    }

    try {
      let savedGroupId: string | undefined;
      if (editingHouseholdId) {
        const result = await updateGroupMutation({
          variables: {
            input: {
              id: editingHouseholdId,
              name: groupName.trim(),
              description: description.trim() || undefined,
              members: membersWithRatios,
            },
          },
        });
        savedGroupId = result.data?.updateGroup.id;
      } else {
        const result = await createGroupMutation({
          variables: {
            input: {
              name: groupName.trim(),
              description: description.trim() || undefined,
              members: membersWithRatios,
            },
          },
        });
        savedGroupId = result.data?.createGroup.id;
      }

      if (savedGroupId) {
        setActiveGroupId(savedGroupId);
      }

      if (!editingHouseholdId && savedGroupId && expenseGroupCategories.length > 0) {
        await Promise.all(
          expenseGroupCategories.map((category) =>
            upsertTemplateMutation({
              variables: {
                input: {
                  groupId: savedGroupId,
                  category,
                  templateName: category,
                  splitDetails: membersWithRatios.map((member) => ({
                    participant: member.name.trim(),
                    ratio: Number(member.ratio.toFixed(2)),
                  })),
                },
              },
            }),
          ),
        );
      }

      closeCreateModal();
    } catch (mutationError) {
      setFormError(
        mutationError instanceof Error
          ? mutationError.message
          : `Unable to ${editingHouseholdId ? 'update' : 'create'} household right now. Please try again.`,
      );
    }
  };

  const onAddExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeGroup) {
      return;
    }

    setExpenseError(null);
    const amount = Number(expenseAmount);
    if (
      !expenseTitle.trim() ||
      !expenseDate ||
      !expenseGroup.trim() ||
      !expenseCategory.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setExpenseError('Please fill all required expense fields.');
      return;
    }

    let split: 'Shared' | 'Custom' = 'Shared';
    let splitDetails: SplitAllocationInput[] | undefined;
    const shouldCreateExpenseGroupTemplate = !selectedExpenseTemplate;
    if (shouldCreateExpenseGroupTemplate) {
      const selectedMembers = expenseMembers.filter((member) => member.selected);
      if (selectedMembers.length === 0) {
        setExpenseError('Select at least one member for this expense.');
        return;
      }
      const hasInvalidRatio = selectedMembers.some(
        (member) => !Number.isFinite(member.ratio) || member.ratio <= 0,
      );
      if (hasInvalidRatio) {
        setExpenseError('Each selected member ratio must be greater than 0.');
        return;
      }
      const ratioTotal = selectedMembers.reduce((sum, member) => sum + member.ratio, 0);
      if (Math.abs(ratioTotal - 100) > 0.01) {
        setExpenseError(`Selected member ratios must add to 100% (current: ${ratioTotal.toFixed(2)}%).`);
        return;
      }
      split = 'Custom';
      splitDetails = selectedMembers.map((member) => ({
        participant: member.name,
        ratio: Number(member.ratio.toFixed(2)),
      }));
    }

    try {
      if (shouldCreateExpenseGroupTemplate && splitDetails) {
        await upsertTemplateMutation({
          variables: {
            input: {
              groupId: activeGroup.id,
              category: expenseGroup.trim(),
              templateName: expenseGroup.trim(),
              splitDetails,
            },
          },
        });
        await refetchGroupTemplates();
        setActiveExpenseGroupCategory(expenseGroup.trim());
      }

      await addExpense({
        title: expenseTitle.trim(),
        amount,
        transactionDate: expenseDate,
        category: expenseCategory.trim(),
        expenseGroup: expenseGroup.trim(),
        split,
        splitDetails,
        groupId: activeGroup.id,
        currency: APP_CURRENCY_CODE,
      });
      closeExpenseModal();
    } catch (mutationError) {
      setExpenseError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to add expense right now. Please try again.',
      );
    }
  };

  const onCreateExpenseGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeGroup) {
      return;
    }
    setTemplateError(null);
    const category = editingTemplateCategory ?? normalizedTemplateCategory;

    if (!category) {
      setTemplateError('Expense group category is required.');
      return;
    }
    const selectedMembers = templateMembers.filter((member) => member.selected);
    if (selectedMembers.length < 2) {
      setTemplateError('Select at least two members for an expense group.');
      return;
    }

    const parsedSelectedMembers = selectedMembers.map((member) => ({
      ...member,
      parsedRatio: Number(member.ratio),
    }));
    const hasInvalidRatio = parsedSelectedMembers.some(
      (member) => !Number.isFinite(member.parsedRatio) || member.parsedRatio <= 0,
    );
    if (hasInvalidRatio) {
      setTemplateError('Each selected member ratio must be greater than 0.');
      return;
    }

    const ratioTotal = parsedSelectedMembers.reduce((sum, member) => sum + member.parsedRatio, 0);
    if (Math.abs(ratioTotal - 100) > 0.01) {
      setTemplateError(`Selected member ratios must add to 100% (current: ${ratioTotal.toFixed(2)}%).`);
      return;
    }

    try {
      await upsertTemplateMutation({
        variables: {
          input: {
            groupId: activeGroup.id,
            category,
            templateName: category,
            splitDetails: parsedSelectedMembers.map((member) => ({
              participant: member.name,
              ratio: Number(member.parsedRatio.toFixed(2)),
            })),
          },
        },
      });
      await refetchGroupTemplates();
      setActiveExpenseGroupCategory(category);
      closeTemplateModal();
    } catch (mutationError) {
      setTemplateError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to create expense group right now. Please try again.',
      );
    }
  };

  const pickClosestOption = (rawValue: string, options: string[]): string => {
    const value = rawValue.trim().toLowerCase();
    if (!value) {
      return rawValue;
    }
    const exact = options.find((option) => option.toLowerCase() === value);
    if (exact) {
      return exact;
    }
    const startsWith = options.find((option) => option.toLowerCase().startsWith(value));
    return startsWith ?? rawValue;
  };
  const onMerchantSearchEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    setExpenseTitle(pickClosestOption(event.currentTarget.value, merchantOptions));
  };

  const canOptOutOfEditingTemplate = useMemo(() => {
    if (!editingTemplateCategory || !user?.fullName) {
      return false;
    }
    const normalizedName = user.fullName.trim().toLowerCase();
    return templateMembers.some(
      (member) => member.selected && member.name.trim().toLowerCase() === normalizedName,
    );
  }, [editingTemplateCategory, templateMembers, user?.fullName]);

  const linkedExpenseCountForEditingTemplate = useMemo(() => {
    if (!activeGroup || !editingTemplateCategory) {
      return 0;
    }
    const categoryKey = editingTemplateCategory.trim().toLowerCase();
    return sharedHouseholdExpenses.filter(
      (expense) => (expense.expenseGroup ?? expense.category).trim().toLowerCase() === categoryKey,
    ).length;
  }, [activeGroup, editingTemplateCategory, sharedHouseholdExpenses]);

  const confirmOptOutOfEditingTemplate = async (): Promise<void> => {
    if (!activeGroup || !editingTemplateCategory) {
      return;
    }
    setTemplateError(null);
    try {
      await declineExpenseGroupMutation({
        variables: {
          groupId: activeGroup.id,
          category: editingTemplateCategory,
        },
      });
      await refetchGroupTemplates();
      const normalizedName = user?.fullName?.trim().toLowerCase();
      if (normalizedName) {
        setTemplateMembers((previous) =>
          previous.map((member) =>
            member.name.trim().toLowerCase() === normalizedName
              ? { ...member, selected: false, ratio: '' }
              : member,
          ),
        );
      }
      setActiveExpenseGroupCategory(ALL_HOUSEHOLD_EXPENSE_GROUPS);
      setTemplateSuccessMessage(`You have opted out of "${editingTemplateCategory}".`);
    } catch (mutationError) {
      setTemplateError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to opt out right now. Please try again.',
      );
      throw mutationError;
    }
  };

  const confirmDeleteEditingTemplate = async (): Promise<void> => {
    if (!activeGroup || !editingTemplateCategory) {
      return;
    }
    setTemplateError(null);
    try {
      const deleted = await deleteExpenseGroupMutation({
        variables: {
          groupId: activeGroup.id,
          category: editingTemplateCategory,
        },
      });
      if (!deleted.data?.deleteExpenseGroup?.id) {
        setTemplateError('Expense group was not found or could not be deleted.');
        return;
      }
      await refetchGroupTemplates();
      setActiveExpenseGroupCategory(ALL_HOUSEHOLD_EXPENSE_GROUPS);
      setTemplateSuccessMessage(`"${editingTemplateCategory}" was deleted.`);
      setEditingTemplateCategory(null);
    } catch (mutationError) {
      setTemplateError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Unable to delete expense group right now. Please try again.',
      );
      throw mutationError;
    }
  };

  return {
    currentUserName: user?.fullName ?? null,
    PREDEFINED_EXPENSE_GROUPS,
    loading,
    error,
    activeGroup,
    sharedHouseholdExpenses,
    setModalOpen,
    openAddExpenseModal,
    activeExpenseGroup,
    openEditHouseholdModal,
    openTemplateModal,
    splitTemplates,
    ALL_HOUSEHOLD_EXPENSE_GROUPS,
    isViewingAllExpenseGroups,
    expenseCountByGroupCategory,
    setActiveExpenseGroupCategory,
    activeExpenseGroupExpenses,
    activeExpenseGroupTotals,
    openEditTemplateModal,
    isModalOpen,
    editingHouseholdId,
    groupName,
    setGroupName,
    description,
    setDescription,
    members,
    createExpenseGroupsOnHouseholdCreate,
    householdExpenseGroups,
    formError,
    creatingGroup,
    updatingGroup,
    savingTemplate,
    closeCreateModal,
    onCreateGroup,
    updateMember,
    setMembers,
    setCreateExpenseGroupsOnHouseholdCreate,
    setHouseholdExpenseGroups,
    isExpenseModalOpen,
    expenseTitle,
    expenseAmount,
    expenseDate,
    expenseGroup,
    expenseCategory,
    merchantOptions,
    expenseGroupOptions,
    sortedExpenseCategories,
    expenseMembers,
    selectedExpenseTemplate,
    expenseError,
    isCreatingExpense,
    isExpenseSubmitDisabled,
    closeExpenseModal,
    onAddExpense,
    merchantCategoryLookup,
    onMerchantSearchEnter,
    setExpenseAmount,
    setExpenseDate,
    setExpenseGroup,
    setExpenseCategory,
    setExpenseMembers,
    setExpenseTitle,
    isTemplateModalOpen,
    templateCategory,
    customTemplateCategory,
    createTemplateCategoryOptions,
    existingTemplateForSelectedCategory,
    selectedTemplateMembersCount,
    templateMembers,
    templateError,
    isTemplateSubmitDisabled,
    closeTemplateModal,
    onCreateExpenseGroup,
    setTemplateCategory,
    setCustomTemplateCategory,
    setTemplateSplitMode,
    clearTemplateRatiosForCustom,
    setTemplateMembers,
    editingTemplateCategory,
    templateSuccessMessage,
    canOptOutOfEditingTemplate,
    linkedExpenseCountForEditingTemplate,
    confirmOptOutOfEditingTemplate,
    confirmDeleteEditingTemplate,
    isDecliningExpenseGroup,
    isDeletingExpenseGroup,
  };
};
