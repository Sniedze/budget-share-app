import { Plus } from 'lucide-react';
import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from '../components/sections';
import { AppLayout, Badge, Button, Card, ErrorText, HeaderRow, HeaderText, MutedText, PageSurface, SectionSubtitle, SectionTitle, Table, TableWrapper, Tbody, Td, Th, Thead, Tr, UserMenu } from '../components/ui';
import { useAuth } from '../features/auth';
import { GET_EXPENSES, buildMerchantSuggestions, useExpenseActions, type GetExpensesResponse, type SplitAllocationInput } from '../features/expenses';
import { AddExpenseModal } from './household/AddExpenseModal';
import { CreateExpenseGroupModal } from './household/CreateExpenseGroupModal';
import { CreateHouseholdModal } from './household/CreateHouseholdModal';
import {
  CREATE_GROUP,
  GET_GROUPS,
  GET_GROUP_SPLIT_TEMPLATES,
  UPDATE_GROUP,
  UPSERT_GROUP_SPLIT_TEMPLATE,
  type GroupMember,
  type SplitTemplate,
  type GroupSummary,
} from '../features/groups';
import { colors, spacing } from '../styles/tokens';

const DEFAULT_MEMBERS: GroupMember[] = [
  { name: 'You', email: 'you@example.com', ratio: 0 },
  { name: '', email: '', ratio: 0 },
];

const getInitialMembers = (): GroupMember[] => {
  return DEFAULT_MEMBERS.map((member) => ({ ...member }));
};

const GroupsGrid = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: ${spacing.lg};

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const GroupList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.md};
`;

const GroupSectionTitle = styled(SectionTitle)`
  text-align: center;
  font-size: 20px;
  margin: 0 0 ${spacing.md};
`;

const GroupCard = styled(Card)<{ $active: boolean }>`
  cursor: pointer;
  border-color: ${({ $active }) => ($active ? colors.accent : colors.border)};
  box-shadow: ${({ $active }) => ($active ? '0 8px 18px rgba(79,70,229,0.12)' : 'none')};
`;

const HouseholdSummaryCard = styled(Card)`
  margin-bottom: ${spacing.lg};
  border: 1px solid ${colors.border};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${spacing.md};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${spacing.sm};
  margin-left: auto;
`;

const ExpenseGroupHeading = styled.h2`
  margin: 0;
  font-size: 30px;
  line-height: 1.2;
  color: ${colors.textPrimary};
`;

const StatCard = styled(Card)`
  display: grid;
  gap: ${spacing.xs};
  padding: ${spacing.md};
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${spacing.md};
  margin: ${spacing.md} 0;

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`;

const DetailHeader = styled(Row)`
  margin-bottom: ${spacing.md};
`;

const ExpenseGroupsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: ${spacing.md};
  margin: ${spacing.md} 0 ${spacing.lg};
`;

const ExpenseGroupCard = styled(Card)`
  display: grid;
  gap: ${spacing.xs};
  padding: ${spacing.md};
`;

const ExpenseGroupMembersGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: ${spacing.sm};
  margin-top: ${spacing.xs};
`;

const ExpenseGroupMemberCard = styled(Card)`
  display: grid;
  gap: 2px;
  padding: ${spacing.sm};
`;

type GroupsQueryData = {
  groups: GroupSummary[];
};

type CreateGroupMutationData = {
  createGroup: GroupSummary;
};

type GroupSplitTemplatesQueryData = {
  groupSplitTemplates: SplitTemplate[];
};

type DraftExpenseGroup = {
  category: string;
  customCategory: string;
};

type TemplateSplitMode = 'equal' | 'ratio_50_50' | 'ratio_60_40' | 'ratio_70_30' | 'custom';

const PREDEFINED_EXPENSE_CATEGORIES = [
  'Groceries',
  'Utilities',
  'Rent',
  'Entertainment',
  'Internet',
  'Transport',
  'Household',
  'Other',
] as const;

const PREDEFINED_EXPENSE_GROUPS = ['Groceries', 'Utilities', 'Rent', 'Entertainment', 'Internet', 'Transport'];

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

export const HouseholdPage = (): JSX.Element => {
  const { user } = useAuth();
  const { data, loading, error } = useQuery<GroupsQueryData>(GET_GROUPS);
  const { data: expensesData } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { addExpense, isMutating: isCreatingExpense } = useExpenseActions(GET_GROUPS);
  const [createGroupMutation, { loading: creatingGroup }] = useMutation<CreateGroupMutationData>(CREATE_GROUP, {
    refetchQueries: [{ query: GET_GROUPS }],
    awaitRefetchQueries: true,
  });
  const [updateGroupMutation, { loading: updatingGroup }] = useMutation<CreateGroupMutationData>(UPDATE_GROUP, {
    refetchQueries: [{ query: GET_GROUPS }],
    awaitRefetchQueries: true,
  });
  const [upsertTemplateMutation, { loading: savingTemplate }] = useMutation(UPSERT_GROUP_SPLIT_TEMPLATE);
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
  const [expenseCategory, setExpenseCategory] = useState('General');
  const [expenseMembers, setExpenseMembers] = useState<Array<{ name: string; selected: boolean; ratio: number }>>([]);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState(PREDEFINED_EXPENSE_GROUPS[0]);
  const [customTemplateCategory, setCustomTemplateCategory] = useState('');
  const [editingTemplateCategory, setEditingTemplateCategory] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateMembers, setTemplateMembers] = useState<Array<{ name: string; selected: boolean; ratio: string }>>(
    [],
  );
  const [templateSplitMode, setTemplateSplitMode] = useState<TemplateSplitMode>('equal');
  const [activeExpenseGroupCategory, setActiveExpenseGroupCategory] = useState('');

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? groups[0],
    [activeGroupId, groups],
  );
  const { data: templatesData, refetch: refetchGroupTemplates } = useQuery<GroupSplitTemplatesQueryData>(
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
    () => [...PREDEFINED_EXPENSE_CATEGORIES].sort((left, right) => left.localeCompare(right)),
    [],
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
  const activeExpenseGroup = useMemo(
    () =>
      splitTemplates.find((template) => template.category === activeExpenseGroupCategory) ?? splitTemplates[0],
    [activeExpenseGroupCategory, splitTemplates],
  );
  const activeExpenseGroupExpenses = useMemo(() => {
    if (!activeGroup || !activeExpenseGroup) {
      return [];
    }
    return activeGroup.expenses.filter(
      (expense) =>
        (expense.expenseGroup ?? expense.category).trim().toLowerCase() ===
        activeExpenseGroup.category.trim().toLowerCase(),
    );
  }, [activeExpenseGroup, activeGroup]);
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
      setActiveExpenseGroupCategory('');
      return;
    }
    const hasActive = splitTemplates.some((template) => template.category === activeExpenseGroupCategory);
    if (!hasActive) {
      setActiveExpenseGroupCategory(splitTemplates[0].category);
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
    setExpenseCategory('General');
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
  };

  const openEditTemplateModal = (template: SplitTemplate) => {
    if (!activeGroup) {
      return;
    }
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
      const result = editingHouseholdId
        ? await updateGroupMutation({
            variables: {
              input: {
                id: editingHouseholdId,
                name: groupName.trim(),
                description: description.trim() || undefined,
                members: membersWithRatios,
              },
            },
          })
        : await createGroupMutation({
            variables: {
              input: {
                name: groupName.trim(),
                description: description.trim() || undefined,
                members: membersWithRatios,
              },
            },
          });

      const createdGroupId = result.data?.createGroup.id;
      if (createdGroupId) {
        setActiveGroupId(createdGroupId);
      }

      if (!editingHouseholdId && createdGroupId && expenseGroupCategories.length > 0) {
        await Promise.all(
          expenseGroupCategories.map((category) =>
            upsertTemplateMutation({
              variables: {
                input: {
                  groupId: createdGroupId,
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

  const getExpenseRatioLabel = (total: number, yourShare: number): string => {
    if (!Number.isFinite(total) || total <= 0) {
      return '-';
    }
    return `${((yourShare / total) * 100).toFixed(2)}%`;
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
    const category = normalizedTemplateCategory;

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

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>{activeGroup?.name ?? 'Households'}</SectionTitle>
            <SectionSubtitle>
              {activeGroup ? 'Household overview and expense groups.' : 'Manage households and expense groups.'}
            </SectionSubtitle>
          </HeaderText>
          <HeaderActions>
            <Button
              type="button"
              $variant="secondary"
              $weight="semibold"
              onClick={() => openAddExpenseModal(activeExpenseGroup?.category)}
              disabled={!activeExpenseGroup}
            >
              + Add Expense
            </Button>
            <Button type="button" $variant="secondary" $weight="semibold" onClick={openEditHouseholdModal} disabled={!activeGroup}>
              Edit Household
            </Button>
            <Button type="button" $variant="accent" $weight="semibold" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Create Household
            </Button>
            <UserMenu />
          </HeaderActions>
        </HeaderRow>

        {activeGroup ? (
          <HouseholdSummaryCard>
            <DetailHeader>
              <div>
                <SectionSubtitle style={{ margin: 0 }}>Household Summary</SectionSubtitle>
                <MutedText style={{ margin: 0 }}>
                  Members: {activeGroup.members.map((member) => member.name).join(', ')}
                </MutedText>
                {activeGroup.description ? <MutedText>{activeGroup.description}</MutedText> : null}
              </div>
            </DetailHeader>

            <StatGrid>
              <StatCard>
                <MutedText>Total Spent</MutedText>
                <strong>${activeGroup.totalSpent.toFixed(2)}</strong>
              </StatCard>
              <StatCard>
                <MutedText>Your Share</MutedText>
                <strong>${activeGroup.yourShare.toFixed(2)}</strong>
              </StatCard>
              <StatCard>
                <MutedText>Members</MutedText>
                <strong>{activeGroup.members.length}</strong>
              </StatCard>
            </StatGrid>
          </HouseholdSummaryCard>
        ) : null}

        <GroupSectionTitle>Household Expense Groups</GroupSectionTitle>
        <GroupsGrid>
          <GroupList>
            <Button
              type="button"
              $variant="secondary"
              $weight="semibold"
              onClick={openTemplateModal}
              disabled={!activeGroup}
            >
              + Create Expense Group
            </Button>
            {loading ? <MutedText>Loading expense groups...</MutedText> : null}
            {error ? <ErrorText>{error.message}</ErrorText> : null}
            {!loading && !error && !activeGroup ? <MutedText>No households yet. Create your first one.</MutedText> : null}
            {!loading && !error && activeGroup && splitTemplates.length === 0 ? (
              <MutedText>No expense groups yet. Create your first one.</MutedText>
            ) : null}
            {splitTemplates.map((template) => (
              <GroupCard
                key={template.id}
                $active={template.category === activeExpenseGroup?.category}
                onClick={() => setActiveExpenseGroupCategory(template.category)}
              >
                <Row>
                  <strong>{template.category}</strong>
                  <Badge $variant="accent">{template.splitDetails.length} members</Badge>
                </Row>
                <MutedText>{template.splitDetails.map((item) => item.participant).join(', ')}</MutedText>
              </GroupCard>
            ))}
          </GroupList>

          {activeGroup ? (
            <Card>
              <Row>
                <ExpenseGroupHeading>
                  {activeExpenseGroup ? `${activeExpenseGroup.category} Expense Group` : 'Select Expense Group'}
                </ExpenseGroupHeading>
                {activeExpenseGroup ? (
                  <Row>
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => openEditTemplateModal(activeExpenseGroup)}
                    >
                      Edit Expense Group
                    </Button>
                    <Button
                      type="button"
                      $variant="secondary"
                      $size="sm"
                      onClick={() => openAddExpenseModal(activeExpenseGroup.category)}
                    >
                      + Add Expense
                    </Button>
                  </Row>
                ) : null}
              </Row>
              {activeExpenseGroup ? (
                <>
                  <ExpenseGroupsGrid>
                    <ExpenseGroupCard>
                      <strong>Members</strong>
                      <ExpenseGroupMembersGrid>
                        {activeExpenseGroup.splitDetails.map((allocation) => (
                          <ExpenseGroupMemberCard key={`${activeExpenseGroup.id}-${allocation.participant}`}>
                            <strong>{allocation.participant}</strong>
                            <MutedText style={{ margin: 0 }}>{allocation.ratio}% share</MutedText>
                          </ExpenseGroupMemberCard>
                        ))}
                      </ExpenseGroupMembersGrid>
                    </ExpenseGroupCard>
                    <ExpenseGroupCard>
                      <strong>Summary</strong>
                      <MutedText style={{ margin: 0 }}>Expenses: {activeExpenseGroupExpenses.length}</MutedText>
                      <MutedText style={{ margin: 0 }}>Total spent: ${activeExpenseGroupTotals.total.toFixed(2)}</MutedText>
                      <MutedText style={{ margin: 0 }}>Your share: ${activeExpenseGroupTotals.yourShare.toFixed(2)}</MutedText>
                    </ExpenseGroupCard>
                  </ExpenseGroupsGrid>
                  <SectionSubtitle>Expense Group Expenses</SectionSubtitle>
                  <TableWrapper>
                    <Table>
                      <Thead>
                        <Tr>
                          <Th>Date</Th>
                          <Th>Description</Th>
                          <Th>Category</Th>
                          <Th>Paid By</Th>
                          <Th>Total</Th>
                          <Th>Expense Ratio</Th>
                          <Th>Your Share</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {activeExpenseGroupExpenses.map((expense) => (
                          <Tr key={`${expense.date}-${expense.description}-${expense.total}`}>
                            <Td>{expense.date}</Td>
                            <Td>{expense.description}</Td>
                            <Td>{expense.category}</Td>
                            <Td>{expense.paidBy}</Td>
                            <Td>${expense.total.toFixed(2)}</Td>
                            <Td>{getExpenseRatioLabel(expense.total, expense.yourShare)}</Td>
                            <Td>${expense.yourShare.toFixed(2)}</Td>
                          </Tr>
                        ))}
                        {activeExpenseGroupExpenses.length === 0 ? (
                          <Tr key="no-expense-group-expenses">
                            <Td colSpan={7}>No expenses for this expense group yet.</Td>
                          </Tr>
                        ) : null}
                      </Tbody>
                    </Table>
                  </TableWrapper>
                </>
              ) : (
                <MutedText>Select an expense group from the left.</MutedText>
              )}
            </Card>
          ) : null}
        </GroupsGrid>
      </PageSurface>

      <CreateHouseholdModal
        isOpen={isModalOpen}
        editingHouseholdId={editingHouseholdId}
        groupName={groupName}
        description={description}
        members={members}
        createExpenseGroupsOnHouseholdCreate={createExpenseGroupsOnHouseholdCreate}
        householdExpenseGroups={householdExpenseGroups}
        predefinedExpenseGroups={PREDEFINED_EXPENSE_GROUPS}
        formError={formError}
        isSaving={creatingGroup || updatingGroup || savingTemplate}
        onClose={closeCreateModal}
        onSubmit={onCreateGroup}
        onGroupNameChange={setGroupName}
        onDescriptionChange={setDescription}
        onMemberChange={updateMember}
        onAddMember={() => setMembers((prev) => [...prev, { name: '', email: '', ratio: 0 }])}
        onRemoveMember={(index) => setMembers((prev) => prev.filter((_, idx) => idx !== index))}
        onToggleCreateExpenseGroups={(enabled) => {
          setCreateExpenseGroupsOnHouseholdCreate(enabled);
          if (enabled && householdExpenseGroups.length === 0) {
            setHouseholdExpenseGroups([{ category: PREDEFINED_EXPENSE_GROUPS[0], customCategory: '' }]);
          }
          if (!enabled) {
            setHouseholdExpenseGroups([]);
          }
        }}
        onExpenseGroupChange={(index, next) =>
          setHouseholdExpenseGroups((previous) =>
            previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ...next } : item)),
          )
        }
        onAddExpenseGroup={() =>
          setHouseholdExpenseGroups((previous) => [
            ...previous,
            { category: PREDEFINED_EXPENSE_GROUPS[0], customCategory: '' },
          ])
        }
        onRemoveExpenseGroup={(index) =>
          setHouseholdExpenseGroups((previous) =>
            previous.filter((_, itemIndex) => itemIndex !== index),
          )
        }
      />

      <AddExpenseModal
        isOpen={isExpenseModalOpen}
        householdName={activeGroup?.name}
        expenseTitle={expenseTitle}
        expenseAmount={expenseAmount}
        expenseDate={expenseDate}
        expenseGroup={expenseGroup}
        expenseCategory={expenseCategory}
        merchantOptions={merchantOptions}
        expenseGroupOptions={expenseGroupOptions}
        categoryOptions={sortedExpenseCategories}
        expenseMembers={expenseMembers}
        hasPredefinedSplit={Boolean(selectedExpenseTemplate)}
        expenseError={expenseError}
        isSubmitting={isCreatingExpense}
        isSubmitDisabled={isExpenseSubmitDisabled}
        onClose={closeExpenseModal}
        onSubmit={onAddExpense}
        onMerchantChange={(merchant) => {
          setExpenseTitle(merchant);
          const matched = merchantCategoryLookup.get(merchant.trim().toLowerCase());
          if (matched) {
            setExpenseCategory(matched.category);
            setExpenseGroup(matched.expenseGroup ?? matched.category);
          }
        }}
        onMerchantKeyDown={onMerchantSearchEnter}
        onAmountChange={setExpenseAmount}
        onDateChange={setExpenseDate}
        onExpenseGroupChange={setExpenseGroup}
        onCategoryChange={setExpenseCategory}
        onMemberToggle={(index, selected) =>
          setExpenseMembers((previous) =>
            previous.map((item, itemIndex) => (itemIndex === index ? { ...item, selected } : item)),
          )
        }
        onMemberRatioChange={(index, ratio) =>
          setExpenseMembers((previous) =>
            previous.map((item, itemIndex) => (itemIndex === index ? { ...item, ratio } : item)),
          )
        }
      />

      <CreateExpenseGroupModal
        isOpen={isTemplateModalOpen}
        householdName={activeGroup?.name}
        editingTemplateCategory={editingTemplateCategory}
        templateCategory={templateCategory}
        customTemplateCategory={customTemplateCategory}
        createTemplateCategoryOptions={createTemplateCategoryOptions}
        existingTemplateForSelectedCategory={Boolean(existingTemplateForSelectedCategory)}
        selectedTemplateMembersCount={selectedTemplateMembersCount}
        templateMembers={templateMembers}
        templateError={templateError}
        isTemplateSubmitDisabled={isTemplateSubmitDisabled}
        isSavingTemplate={savingTemplate}
        onClose={closeTemplateModal}
        onSubmit={onCreateExpenseGroup}
        onTemplateCategoryChange={setTemplateCategory}
        onCustomTemplateCategoryChange={setCustomTemplateCategory}
        onSplitModeEqual={() => setTemplateSplitMode('equal')}
        onSplitMode5050={() => setTemplateSplitMode('ratio_50_50')}
        onSplitMode6040={() => setTemplateSplitMode('ratio_60_40')}
        onSplitMode7030={() => setTemplateSplitMode('ratio_70_30')}
        onSplitModeCustom={() => {
          setTemplateSplitMode('custom');
          clearTemplateRatiosForCustom();
        }}
        onTemplateMemberToggle={(index, selected) =>
          setTemplateMembers((previous) =>
            previous.map((item, itemIndex) =>
              itemIndex === index
                ? {
                    ...item,
                    selected,
                    ratio: selected ? item.ratio : '',
                  }
                : item,
            ),
          )
        }
        onTemplateMemberRatioChange={(index, ratio) =>
          setTemplateMembers((previous) =>
            previous.map((item, itemIndex) =>
              itemIndex === index ? { ...item, ratio } : item,
            ),
          )
        }
      />
    </AppLayout>
  );
};
