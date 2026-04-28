import { useQuery } from '@apollo/client/react';
import { FormEvent, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Sidebar } from '../components/Sidebar';
import { ExpenseForm } from '../features/expenses/components/ExpenseForm';
import { ExpenseList } from '../features/expenses/components/ExpenseList';
import { GET_EXPENSES } from '../features/expenses/graphql';
import type { Expense, GetExpensesResponse } from '../features/expenses/types';
import { useExpenseActions } from '../hooks/useExpenseActions';

const AppLayout = styled.main`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  background: #f3f4f6;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Page = styled.section`
  margin: 24px;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
`;

const HeaderRow = styled.header`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
`;

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
`;

const PageTitle = styled.h1`
  margin: 0;
  font-size: 34px;
  line-height: 1.1;
`;

const PageSubtitle = styled.p`
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 14px;
`;

const AddExpenseButton = styled.button`
  border: 0;
  border-radius: 10px;
  padding: 10px 16px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  background: #4f46e5;
  cursor: pointer;
  box-shadow: 0 10px 18px rgba(79, 70, 229, 0.2);

  &:hover {
    background: #4338ca;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Placeholder = styled.p`
  color: #6b7280;
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
            <PageTitle>Dashboard</PageTitle>
            <PageSubtitle>Overview of your expenses and spending patterns</PageSubtitle>
          </HeaderText>
          <AddExpenseButton type="button">+ Add Expense</AddExpenseButton>
        </HeaderRow>

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

        {loading ? <Placeholder>Loading expenses...</Placeholder> : null}
        {error ? <Placeholder>Error: {error.message}</Placeholder> : null}
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
