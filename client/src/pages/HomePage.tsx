import { useQuery } from '@apollo/client/react';
import { FormEvent, useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChartsSection, Sidebar, StatsSection } from '../components/sections';
import { Button, MutedText, SectionSubtitle, SectionTitle } from '../components/ui';
import {
  GET_EXPENSES,
  getBreakdownData,
  getDashboardStats,
  getTotalAmount,
  getTrendData,
  ExpenseForm,
  ExpenseList,
  useExpenseActions,
} from '../features/expenses';
import type { Expense, GetExpensesResponse } from '../features/expenses';
import { colors, radii, spacing } from '../styles/tokens';

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
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const { addExpense, updateExpense, deleteExpense, isMutating } = useExpenseActions(GET_EXPENSES);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setTransactionDate(new Date().toISOString().slice(0, 10));
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
    if (!title.trim() || Number.isNaN(parsedAmount) || !transactionDate) return;

    if (editingId) {
      await updateExpense({
        id: editingId,
        title: title.trim(),
        amount: parsedAmount,
        transactionDate,
      });
    } else {
      await addExpense({
        title: title.trim(),
        amount: parsedAmount,
        transactionDate,
      });
    }

    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(String(expense.amount));
    setTransactionDate(expense.transactionDate.slice(0, 10));
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
          editingId={editingId}
          isMutating={isMutating}
          onTitleChange={setTitle}
          onAmountChange={setAmount}
          onTransactionDateChange={setTransactionDate}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />

        {loading ? <MutedText>Loading expenses...</MutedText> : null}
        {error ? <MutedText>Error: {error.message}</MutedText> : null}
        {!loading && !error ? (
          <ExpenseList
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
