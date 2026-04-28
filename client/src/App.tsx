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
      transactionDate
      category
      split
    }
  }
`;

type Expense = {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  transactionDate: string;
  category: string;
  split: string;
};

type GetExpensesResponse = {
  expenses: Expense[];
};

const DEFAULT_CATEGORY = 'General';
const DEFAULT_SPLIT = 'Personal';

const getTodayDateInput = (): string => {
  const now = new Date();
  const timezoneOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
};

const Page = styled.main`
  max-width: 760px;
  margin: 40px auto;
  padding: 24px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
`;

const Title = styled.h1`
  margin: 0 0 20px;
`;

const Form = styled.form`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
  flex-wrap: wrap;
`;

const Input = styled.input`
  font: inherit;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  flex: 1;
  min-width: 140px;
`;

const Button = styled.button`
  font: inherit;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const DeleteButton = styled(Button)`
  background: #ef4444;
`;

const SecondaryButton = styled(Button)`
  background: #6b7280;
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
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
        <Input
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
          type="date"
        />
        <Input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
        />
        <Input
          as="select"
          value={split}
          onChange={(e) => setSplit(e.target.value)}
        >
          <option value="Personal">Personal</option>
          <option value="Shared">Shared</option>
        </Input>
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
                <strong>{expense.title}</strong> ({expense.category}, {expense.split}) - $
                {expense.amount.toFixed(2)}
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
