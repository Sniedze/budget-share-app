import { useQuery } from '@apollo/client/react';
import { FormEvent, useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChartsSection, RecentExpensesSection, Sidebar, StatsSection } from '../components/sections';
import { Button, MutedText, SectionSubtitle, SectionTitle } from '../components/ui';
import {
  GET_EXPENSES,
  getBreakdownData,
  getDashboardStats,
  getTotalAmount,
  getTrendData,
  ExpenseForm,
  useExpenseActions,
} from '../features/expenses';
import type { Expense, GetExpensesResponse } from '../features/expenses';
import { colors, radii, spacing } from '../styles/tokens';

const DEFAULT_CATEGORY = 'General';
const DEFAULT_SPLIT = 'Personal';

const getTodayDateInput = (): string => {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

const AppLayout = styled.main`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  background: ${colors.background};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Page = styled.section`
  margin: ${spacing.xxl};
  padding: ${spacing.xxl};
  background: ${colors.surface};
  border-radius: ${radii.lg};
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
`;

const HeaderRow = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${spacing.lg};
  margin-bottom: ${spacing.xl};
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
`;

export const HomePage = (): JSX.Element => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => getTodayDateInput());
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { addExpense, updateExpense, deleteExpense, isMutating } = useExpenseActions(GET_EXPENSES);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setTransactionDate(getTodayDateInput());
    setCategory(DEFAULT_CATEGORY);
    setSplit(DEFAULT_SPLIT);
    setEditingId(null);
  };

  const expenses = useMemo(() => data?.expenses ?? [], [data]);
  const totalAmount = useMemo(() => getTotalAmount(expenses), [expenses]);
  const stats = useMemo(() => getDashboardStats(totalAmount), [totalAmount]);
  const trendData = useMemo(() => getTrendData(expenses), [expenses]);
  const breakdownData = useMemo(() => getBreakdownData(expenses), [expenses]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(amount);
    if (!title.trim() || Number.isNaN(parsedAmount) || !transactionDate || !category || !split) return;

    if (editingId) {
      await updateExpense({
        id: editingId,
        title: title.trim(),
        amount: parsedAmount,
        transactionDate,
        category,
        split,
      });
    } else {
      await addExpense({
        title: title.trim(),
        amount: parsedAmount,
        transactionDate,
        category,
        split,
      });
    }

    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setTransactionDate(expense.transactionDate.slice(0, 10));
    setCategory(expense.category);
    setSplit(expense.split);
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

      <Page>
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
          title={title}
          amount={amount}
          transactionDate={transactionDate}
          category={category}
          split={split}
          editingId={editingId}
          isMutating={isMutating}
          onTitleChange={setTitle}
          onAmountChange={setAmount}
          onTransactionDateChange={setTransactionDate}
          onCategoryChange={setCategory}
          onSplitChange={setSplit}
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
      </Page>
    </AppLayout>
  );
};
