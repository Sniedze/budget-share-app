import { useQuery } from '@apollo/client/react';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChartsSection, MonthlyOverviewSection, RecentExpensesSection, Sidebar, StatsSection } from '../components/sections';
import { AppLayout, HeaderRow, HeaderText, MutedText, PageSurface, SectionSubtitle, SectionTitle, UserMenu } from '../components/ui';
import { APP_CURRENCY_CODE } from '../format/currency';
import {
  DEFAULT_EXPENSE_CATEGORIES,
  GET_EXPENSES,
  buildMerchantSuggestions,
  getBreakdownData,
  getDashboardStats,
  getTotalAmount,
  getTrendData,
  ExpenseForm,
  outgoingExpensesOnly,
  useExpenseActions,
} from '../features/expenses';
import { getMonthlyOverview } from '../features/expenses/selectors/expenseAnalytics';
import type { Expense, GetExpensesResponse, SplitAllocationInput, SplitType } from '../features/expenses';
import { GET_GROUPS, GET_GROUP_SPLIT_TEMPLATES } from '../features/groups';
import type { GroupSummary, SplitTemplate } from '../features/groups';
import { colors, radii, spacing } from '../styles/tokens';

const DEFAULT_CATEGORY = DEFAULT_EXPENSE_CATEGORIES[0];
const DEFAULT_SPLIT: SplitType = 'Personal';
const DEFAULT_CUSTOM_SPLIT_DETAILS: SplitAllocationInput[] = [
  { participant: 'You', ratio: 50 },
  { participant: 'Partner', ratio: 50 },
];

const getTodayDateInput = (): string => {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

const AnalyticsTabs = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${spacing.sm};
  padding: ${spacing.xs};
  border: 1px solid ${colors.border};
  border-radius: ${radii.full};
  background: ${colors.surface};
`;

const AnalyticsTabButton = styled.button<{ $isActive: boolean }>`
  border: 0;
  cursor: pointer;
  border-radius: ${radii.full};
  padding: ${spacing.sm} ${spacing.lg};
  font-size: 0.9rem;
  font-weight: 600;
  color: ${({ $isActive }) => ($isActive ? '#ffffff' : colors.textMuted)};
  background: ${({ $isActive }) => ($isActive ? colors.primary : 'transparent')};
`;

type ExpenseFormValues = {
  title: string;
  amount: string;
  transactionDate: string;
  category: string;
  groupId: string;
  expenseGroup: string;
  isPrivate: boolean;
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
  isPrivate: false,
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
  isPrivate: expense.isPrivate ?? false,
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
  const [queuedExpenses, setQueuedExpenses] = useState<ExpenseFormValues[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analyticsView, setAnalyticsView] = useState<'table' | 'charts'>('table');

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

  const cloneFormValues = (values: ExpenseFormValues): ExpenseFormValues => ({
    ...values,
    splitDetails: values.splitDetails.map((detail) => ({ ...detail })),
  });

  const expenses = useMemo(() => data?.expenses ?? [], [data]);
  const outgoingExpenses = useMemo(() => outgoingExpensesOnly(expenses), [expenses]);
  const totalAmount = useMemo(() => getTotalAmount(outgoingExpenses), [outgoingExpenses]);
  const stats = useMemo(() => getDashboardStats(totalAmount), [totalAmount]);
  const trendData = useMemo(() => getTrendData(outgoingExpenses), [outgoingExpenses]);
  const breakdownData = useMemo(() => getBreakdownData(outgoingExpenses), [outgoingExpenses]);
  const monthlyOverview = useMemo(() => getMonthlyOverview(outgoingExpenses), [outgoingExpenses]);
  const householdOptions = useMemo(() => groupsData?.groups ?? [], [groupsData?.groups]);
  const sortedCategoryOptions = useMemo(
    () => [...DEFAULT_EXPENSE_CATEGORIES].sort((left, right) => left.localeCompare(right)),
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

    const isBaseFormValid = (values: ExpenseFormValues): boolean => {
      const parsedAmount = Number(values.amount);
      if (
        !values.title.trim() ||
        Number.isNaN(parsedAmount) ||
        !values.transactionDate ||
        !values.category ||
        !values.split
      ) {
        return false;
      }
      if (values.split === 'Shared' && (!values.groupId || !values.expenseGroup)) {
        return false;
      }
      return true;
    };

    const toAddPayload = (values: ExpenseFormValues) => {
      const parsedAmount = Number(values.amount);
      const normalizedSplitDetails = values.splitDetails
        .map((detail) => ({
          participant: detail.participant.trim(),
          ratio: Number(detail.ratio),
        }))
        .filter((detail) => detail.participant.length > 0 && Number.isFinite(detail.ratio) && detail.ratio > 0);

      return {
        title: values.title.trim(),
        amount: parsedAmount,
        transactionDate: values.transactionDate,
        category: values.category,
        expenseGroup: values.split === 'Shared' ? values.expenseGroup : undefined,
        split: values.split,
        splitDetails: values.split === 'Custom' ? normalizedSplitDetails : undefined,
        groupId: values.split === 'Shared' ? values.groupId : undefined,
        isPrivate: values.split === 'Shared' && Boolean(values.groupId) ? values.isPrivate : false,
        currency: APP_CURRENCY_CODE,
        flow: 'Outgoing' as const,
      };
    };

    if (editingId) {
      if (!isBaseFormValid(formValues)) {
        return;
      }
      const payload = toAddPayload(formValues);
      const existing = expenses.find((item) => item.id === editingId);
      await updateExpense({
        id: editingId,
        ...payload,
        currency: existing?.currency ?? APP_CURRENCY_CODE,
        flow: existing?.flow ?? 'Outgoing',
      });
    } else {
      const expensesToCreate = [...queuedExpenses];
      if (isBaseFormValid(formValues)) {
        expensesToCreate.push(formValues);
      }
      if (expensesToCreate.length === 0) {
        return;
      }
      for (const values of expensesToCreate) {
        await addExpense(toAddPayload(values));
      }
      setQueuedExpenses([]);
    }

    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setFormValues(toFormValuesFromExpense(expense));
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.name === 'isPrivate') {
      setFormValues((previous) => ({
        ...previous,
        isPrivate: target.checked,
      }));
      return;
    }
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
      ...(name === 'split' && value !== 'Shared' ? { groupId: '', expenseGroup: '', isPrivate: false } : {}),
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

  const handleQueueExpense = () => {
    const parsedAmount = Number(formValues.amount);
    const isValid =
      formValues.title.trim().length > 0 &&
      !Number.isNaN(parsedAmount) &&
      formValues.transactionDate.trim().length > 0 &&
      formValues.category.trim().length > 0 &&
      (formValues.split !== 'Shared' || (formValues.groupId.trim().length > 0 && formValues.expenseGroup.trim().length > 0));
    if (!isValid || editingId) {
      return;
    }
    setQueuedExpenses((previous) => [...previous, cloneFormValues(formValues)]);
    setFormValues(getInitialFormValues());
  };

  const handleClearQueuedExpenses = () => {
    setQueuedExpenses([]);
  };

  const handleRemoveQueuedExpense = (index: number) => {
    setQueuedExpenses((previous) => previous.filter((_, queuedIndex) => queuedIndex !== index));
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
          queuedExpenses={queuedExpenses}
          queuedExpensesCount={queuedExpenses.length}
          onQueueExpense={handleQueueExpense}
          onClearQueuedExpenses={handleClearQueuedExpenses}
          onRemoveQueuedExpense={handleRemoveQueuedExpense}
        />

        {loading ? <MutedText>Loading expenses...</MutedText> : null}
        {error ? <MutedText>Error: {error.message}</MutedText> : null}
        {!loading && !error ? (
          <RecentExpensesSection
            expenses={outgoingExpenses}
            isMutating={isMutating}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : null}

        <AnalyticsTabs>
          <AnalyticsTabButton $isActive={analyticsView === 'table'} type="button" onClick={() => setAnalyticsView('table')}>
            Monthly Overview
          </AnalyticsTabButton>
          <AnalyticsTabButton
            $isActive={analyticsView === 'charts'}
            type="button"
            onClick={() => setAnalyticsView('charts')}
          >
            Charts
          </AnalyticsTabButton>
        </AnalyticsTabs>

        {analyticsView === 'table' ? (
          <MonthlyOverviewSection rows={monthlyOverview} />
        ) : (
          <ChartsSection trendData={trendData} breakdownData={breakdownData} />
        )}
      </PageSurface>
    </AppLayout>
  );
};
