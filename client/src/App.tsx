import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { FormEvent, useState } from 'react';
import styled from 'styled-components';
import { useExpenseActions } from './hooks/useExpenseActions';

const GET_EXPENSES = gql`
  query GetExpenses {
    expenses {
      id
      title
      amount
      createdAt
    }
  }
`;

type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
};

type GetExpensesResponse = {
  expenses: Expense[];
};

const Page = styled.main`
  max-width: 720px;
  margin: 40px auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
`;

const Title = styled.h1`
  margin-top: 0;
  margin-bottom: 20px;
`;

const Form = styled.form`
  display: grid;
  grid-template-columns: 1fr 140px auto;
  gap: 10px;
  margin-bottom: 20px;
`;

const Input = styled.input`
  font: inherit;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
`;

const Button = styled.button`
  font: inherit;
  padding: 10px 12px;
  border-radius: 8px;
  border: none;
  background: #2563eb;
  color: white;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DeleteButton = styled(Button)`
  background: #ef4444;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
`;

const ListItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

const App = (): JSX.Element => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);

  const { addExpense, updateExpense, deleteExpense, isMutating } = useExpenseActions(GET_EXPENSES);

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(amount);

    if (!title.trim() || Number.isNaN(parsedAmount)) return;

    if (editingId) {
      await updateExpense({
        id: editingId,
        title: title.trim(),
        amount: parsedAmount,
      });
    } else {
      await addExpense({
        title: title.trim(),
        amount: parsedAmount,
      });
    }

    resetForm();
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setTitle(expense.title);
    setAmount(String(expense.amount));
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);

    if (editingId === id) {
      resetForm();
    }
  };

  if (loading) return <p>Loading expenses...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <Page>
      <Title>Household Budget</Title>

      <Form onSubmit={handleSubmit}>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Expense title"
        />
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          type="number"
          step="0.01"
        />
        <Button type="submit" disabled={isMutating}>
          {editingId ? 'Save' : 'Add expense'}
        </Button>
        {editingId ? (
          <SecondaryButton type="button" onClick={resetForm} disabled={isMutating}>
            Cancel
          </SecondaryButton>
        ) : null}
      </Form>

      {data?.expenses.length ? (
        <List>
          {data.expenses.map((expense) => (
            <ListItem key={expense.id}>
              <span>
                <strong>{expense.title}</strong> - ${expense.amount.toFixed(2)}
              </span>
              <Actions>
                <Button type="button" onClick={() => handleEdit(expense)} disabled={isMutating}>
                  Edit
                </Button>
                <DeleteButton
                  type="button"
                  onClick={() => handleDelete(expense.id)}
                  disabled={isMutating}
                >
                  Delete
                </DeleteButton>
              </Actions>
            </ListItem>
          ))}
        </List>
      ) : (
        <p>No expenses yet.</p>
      )}
    </Page>
  );
};

export default App;
