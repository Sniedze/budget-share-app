import { useQuery } from '@apollo/client/react';
import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { ChartsSection, RecentExpensesSection, Sidebar, StatsSection } from '../components/sections';
import { AppLayout, Button, HeaderRow, HeaderText, MutedText, PageSurface, SectionSubtitle, SectionTitle } from '../components/ui';
import { GET_EXPENSES, getBreakdownData, getDashboardStats, getTotalAmount, getTrendData, ExpenseForm, useExpenseActions } from '../features/expenses';
import type { Expense, GetExpensesResponse, SplitAllocationInput, SplitType } from '../features/expenses';

const DEFAULT_CATEGORY = 'General';
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

type ExpenseFormValues = {
  title: string;
  amount: string;
  transactionDate: string;
  category: string;
  split: SplitType;
  splitDetails: SplitAllocationInput[];
};

const getInitialFormValues = (): ExpenseFormValues => ({
  title: '',
  amount: '',
  transactionDate: getTodayDateInput(),
  category: DEFAULT_CATEGORY,
  split: DEFAULT_SPLIT,
  splitDetails: DEFAULT_CUSTOM_SPLIT_DETAILS,
});

const toFormValuesFromExpense = (expense: Expense): ExpenseFormValues => ({
  title: expense.title,
  amount: String(expense.amount),
  transactionDate: expense.transactionDate.slice(0, 10),
  category: expense.category,
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
  const { addExpense, updateExpense, deleteExpense, isMutating } = useExpenseActions(GET_EXPENSES);

  const resetForm = () => {
    setFormValues(getInitialFormValues());
    setEditingId(null);
  };

  const expenses = useMemo(() => data?.expenses ?? [], [data]);
  const totalAmount = useMemo(() => getTotalAmount(expenses), [expenses]);
  const stats = useMemo(() => getDashboardStats(totalAmount), [totalAmount]);
  const trendData = useMemo(() => getTrendData(expenses), [expenses]);
  const breakdownData = useMemo(() => getBreakdownData(expenses), [expenses]);

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
        split: formValues.split,
        splitDetails: payloadSplitDetails,
      });
    } else {
      await addExpense({
        title: formValues.title.trim(),
        amount: parsedAmount,
        transactionDate: formValues.transactionDate,
        category: formValues.category,
        split: formValues.split,
        splitDetails: payloadSplitDetails,
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
    setFormValues({
      ...formValues,
      [name]:
        name === 'split' ? (value as SplitType) : (value as ExpenseFormValues[keyof ExpenseFormValues]),
      ...(name === 'split' && value === 'Custom' && formValues.splitDetails.length === 0
        ? { splitDetails: DEFAULT_CUSTOM_SPLIT_DETAILS }
        : {}),
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
            <SectionTitle>Dashboard</SectionTitle>
            <SectionSubtitle>Overview of your expenses and spending patterns</SectionSubtitle>
          </HeaderText>
          <Button
            type="button"
            $variant="accent"
            $size="lg"
            $radius="md"
            $weight="semibold"
            $elevation="accent"
          >
            + Add Expense
          </Button>
        </HeaderRow>

        <StatsSection stats={stats} />

        <ChartsSection trendData={trendData} breakdownData={breakdownData} />

        <ExpenseForm
          {...formValues}
          editingId={editingId}
          isMutating={isMutating}
          onInputChange={onInputChange}
          onSplitDetailChange={handleSplitDetailChange}
          onAddSplitDetail={handleAddSplitDetail}
          onRemoveSplitDetail={handleRemoveSplitDetail}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />

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
