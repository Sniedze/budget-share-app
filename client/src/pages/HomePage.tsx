import { useQuery } from '@apollo/client/react';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { ChartsSection, MonthlyOverviewSection, RecentExpensesSection, Sidebar, StatsSection } from '../components/sections';
import { AppLayout, HeaderRow, HeaderText, MutedText, PageSurface, SectionSubtitle, SectionTitle, UserMenu } from '../components/ui';
import { GET_EXPENSES, buildMerchantSuggestions, getBreakdownData, getDashboardStats, getTotalAmount, getTrendData, ExpenseForm, useExpenseActions } from '../features/expenses';
import { getMonthlyOverview } from '../features/expenses/selectors/expenseAnalytics';
import type { Expense, GetExpensesResponse, SplitAllocationInput, SplitType } from '../features/expenses';
import { GET_GROUPS, GET_GROUP_SPLIT_TEMPLATES } from '../features/groups';
import type { GroupSummary, SplitTemplate } from '../features/groups';

const DEFAULT_CATEGORY = 'General';
const DEFAULT_SPLIT: SplitType = 'Personal';
const DEFAULT_CATEGORY_OPTIONS = ['General', 'Groceries', 'Utilities', 'Rent', 'Transport', 'Entertainment', 'Health', 'Other'];
const DEFAULT_CUSTOM_SPLIT_DETAILS: SplitAllocationInput[] = [
  { participant: 'You', ratio: 50 },
  { participant: 'Partner', ratio: 50 },
];

const getTodayDateInput = (): string => {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

type ExpenseFormValues = {
  title: string;
  amount: string;
  transactionDate: string;
  category: string;
  groupId: string;
  expenseGroup: string;
  split: SplitType;
  splitDetails: SplitAllocationInput[];
};

const getInitialFormValues = (): ExpenseFormValues => ({
  title: '',
  amount: '',
  transactionDate: getTodayDateInput(),
  category: DEFAULT_CATEGORY,
  groupId: '',
  expenseGroup: '',
  split: DEFAULT_SPLIT,
  splitDetails: DEFAULT_CUSTOM_SPLIT_DETAILS,
});

const toFormValuesFromExpense = (expense: Expense): ExpenseFormValues => ({
  title: expense.title,
  amount: String(expense.amount),
  transactionDate: expense.transactionDate.slice(0, 10),
  category: expense.category,
  groupId: expense.groupId ?? '',
  expenseGroup: expense.groupId ? (expense.expenseGroup ?? '') : '',
  split: expense.split,
  splitDetails:
    expense.splitDetails.length > 0
      ? expense.splitDetails.map((detail) => ({
          participant: detail.participant,
          ratio: detail.ratio,
        }))
      : DEFAULT_CUSTOM_SPLIT_DETAILS,
});

export const HomePage = (): JSX.Element => {
  const [formValues, setFormValues] = useState<ExpenseFormValues>(() => getInitialFormValues());
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { data: groupsData } = useQuery<{ groups: GroupSummary[] }>(GET_GROUPS);
  const { addExpense, updateExpense, deleteExpense, isMutating } = useExpenseActions(GET_EXPENSES);
  const { data: groupTemplatesData } = useQuery<{ groupSplitTemplates: SplitTemplate[] }>(GET_GROUP_SPLIT_TEMPLATES, {
    variables: { groupId: formValues.groupId },
    skip: !formValues.groupId || formValues.split !== 'Shared',
  });

  const resetForm = () => {
    setFormValues(getInitialFormValues());
    setEditingId(null);
  };

  const expenses = useMemo(() => data?.expenses ?? [], [data]);
  const totalAmount = useMemo(() => getTotalAmount(expenses), [expenses]);
  const stats = useMemo(() => getDashboardStats(totalAmount), [totalAmount]);
  const trendData = useMemo(() => getTrendData(expenses), [expenses]);
  const breakdownData = useMemo(() => getBreakdownData(expenses), [expenses]);
  const monthlyOverview = useMemo(() => getMonthlyOverview(expenses), [expenses]);
  const householdOptions = useMemo(() => groupsData?.groups ?? [], [groupsData?.groups]);
  const sortedCategoryOptions = useMemo(
    () => [...DEFAULT_CATEGORY_OPTIONS].sort((left, right) => left.localeCompare(right)),
    [],
  );
  const merchantCategoryLookup = useMemo(() => {
    return buildMerchantSuggestions(expenses);
  }, [expenses]);
  const merchantOptions = useMemo(
    () => Array.from(merchantCategoryLookup.values()).map((entry) => entry.merchant),
    [merchantCategoryLookup],
  );
  const expenseGroupOptions = useMemo(
    () =>
      (groupTemplatesData?.groupSplitTemplates ?? [])
        .map((template) => template.category)
        .sort((left, right) => left.localeCompare(right)),
    [groupTemplatesData?.groupSplitTemplates],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(formValues.amount);
    if (
      !formValues.title.trim() ||
      Number.isNaN(parsedAmount) ||
      !formValues.transactionDate ||
      !formValues.category ||
      !formValues.split
    ) {
      return;
    }
    if (formValues.split === 'Shared' && (!formValues.groupId || !formValues.expenseGroup)) {
      return;
    }

    const normalizedSplitDetails = formValues.splitDetails
      .map((detail) => ({
        participant: detail.participant.trim(),
        ratio: Number(detail.ratio),
      }))
      .filter((detail) => detail.participant.length > 0 && Number.isFinite(detail.ratio) && detail.ratio > 0);

    const payloadSplitDetails = formValues.split === 'Custom' ? normalizedSplitDetails : undefined;

    if (editingId) {
      await updateExpense({
        id: editingId,
        title: formValues.title.trim(),
        amount: parsedAmount,
        transactionDate: formValues.transactionDate,
        category: formValues.category,
        expenseGroup: formValues.split === 'Shared' ? formValues.expenseGroup : undefined,
        split: formValues.split,
        splitDetails: payloadSplitDetails,
        groupId: formValues.split === 'Shared' ? formValues.groupId : undefined,
      });
    } else {
      await addExpense({
        title: formValues.title.trim(),
        amount: parsedAmount,
        transactionDate: formValues.transactionDate,
        category: formValues.category,
        expenseGroup: formValues.split === 'Shared' ? formValues.expenseGroup : undefined,
        split: formValues.split,
        splitDetails: payloadSplitDetails,
        groupId: formValues.split === 'Shared' ? formValues.groupId : undefined,
      });
    }

    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setFormValues(toFormValuesFromExpense(expense));
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    const normalizedMerchant = value.trim().toLowerCase();
    const matchedMerchantCategory =
      name === 'title' ? merchantCategoryLookup.get(normalizedMerchant)?.category : undefined;
    setFormValues({
      ...formValues,
      [name]:
        name === 'split' ? (value as SplitType) : (value as ExpenseFormValues[keyof ExpenseFormValues]),
      ...(matchedMerchantCategory ? { category: matchedMerchantCategory } : {}),
      ...(name === 'split' && value === 'Custom' && formValues.splitDetails.length === 0
        ? { splitDetails: DEFAULT_CUSTOM_SPLIT_DETAILS }
        : {}),
      ...(name === 'split' && value !== 'Shared' ? { groupId: '', expenseGroup: '' } : {}),
      ...(name === 'groupId' ? { expenseGroup: '' } : {}),
    });
  };

  const handleSplitDetailsAction = (action: 'add' | 'remove', index?: number) => {
    if (action === 'add') {
      setFormValues((previous) => ({
        ...previous,
        splitDetails: [...previous.splitDetails, { participant: '', ratio: 0 }],
      }));
      return;
    }

    if (typeof index === 'number') {
      setFormValues((previous) => ({
        ...previous,
        splitDetails: previous.splitDetails.filter((_, entryIndex) => entryIndex !== index),
      }));
    }
  };

  const handleSplitDetailChange = (index: number, field: 'participant' | 'ratio', value: string) => {
    setFormValues((previous) => ({
      ...previous,
      splitDetails: previous.splitDetails.map((entry, entryIndex) => {
        if (entryIndex !== index) {
          return entry;
        }

        if (field === 'participant') {
          return { ...entry, participant: value };
        }

        return { ...entry, ratio: Number(value) };
      }),
    }));
  };

  const handleAddSplitDetail = () => {
    handleSplitDetailsAction('add');
  };

  const handleRemoveSplitDetail = (index: number) => {
    handleSplitDetailsAction('remove', index);
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <AppLayout>
      <Sidebar />

      <PageSurface>
        <HeaderRow>
          <HeaderText>
            <SectionTitle>Personal Finances</SectionTitle>
            <SectionSubtitle>Overview of your expenses and spending patterns</SectionSubtitle>
          </HeaderText>
          <UserMenu />
        </HeaderRow>

        <StatsSection stats={stats} />

        <ExpenseForm
          {...formValues}
          categoryOptions={sortedCategoryOptions}
          merchantOptions={merchantOptions}
          householdOptions={householdOptions.map((group) => ({ id: group.id, name: group.name }))}
          expenseGroupOptions={expenseGroupOptions}
          editingId={editingId}
          isMutating={isMutating}
          onInputChange={onInputChange}
          onSplitDetailChange={handleSplitDetailChange}
          onAddSplitDetail={handleAddSplitDetail}
          onRemoveSplitDetail={handleRemoveSplitDetail}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />

        <ChartsSection trendData={trendData} breakdownData={breakdownData} />
        <MonthlyOverviewSection rows={monthlyOverview} />

        {loading ? <MutedText>Loading expenses...</MutedText> : null}
        {error ? <MutedText>Error: {error.message}</MutedText> : null}
        {!loading && !error ? (
          <RecentExpensesSection
            expenses={expenses}
            isMutating={isMutating}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};
