import { useQuery } from '@apollo/client/react';
import { FormEvent, useMemo, useState } from 'react';
import styled from 'styled-components';
import { GET_EXPENSES } from './features/expenses/graphql';
import { ExpenseForm } from './features/expenses/components/ExpenseForm';
import { ExpenseList } from './features/expenses/components/ExpenseList';
import type { Expense, GetExpensesResponse } from './features/expenses/types';
import { useExpenseActions } from './hooks/useExpenseActions';
import { Sidebar } from './components/Sidebar';
import './App.css';

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

const PageTitle = styled.h1`
  margin: 0 0 20px;
`;

const Placeholder = styled.p`
  color: #6b7280;
`;

const App = (): JSX.Element => {
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
        <PageTitle>Household Budget</PageTitle>

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

export default App;
