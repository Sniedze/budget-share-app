import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { FormEvent, useState } from 'react';
import styled from 'styled-components';

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

const ADD_EXPENSE = gql`
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) {
      id
      title
      amount
      createdAt
    }
  }
`;
const DELETE_EXPENSE = gql`
  mutation DeleteExpense($input: DeleteExpenseInput!) {
    deleteExpense(input: $input)
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

type AddExpenseResponse = {
  addExpense: Expense;
};

type AddExpenseVariables = {
  input: {
    title: string;
    amount: number;
  };
};

type DeleteExpenseResponse = {
  deleteExpense: boolean;
};

type DeleteExpenseVariables = {
  input: {
    id: string;
  };
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
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
`;

function App() {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);

  const [addExpense, { loading: adding }] = useMutation<AddExpenseResponse, AddExpenseVariables>(
    ADD_EXPENSE,
    {
      refetchQueries: [{ query: GET_EXPENSES }],
    },
  );

  const [removeExpense, { loading: deleting }] = useMutation<
    DeleteExpenseResponse,
    DeleteExpenseVariables
  >(DELETE_EXPENSE, {
    refetchQueries: [{ query: GET_EXPENSES }],
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(amount);

    if (!title.trim() || Number.isNaN(parsedAmount)) {
      return;
    }

    await addExpense({
      variables: {
        input: {
          title: title.trim(),
          amount: parsedAmount,
        },
      },
    });

    setTitle('');
    setAmount('');
  };

  const handleDelete = async (id: string) => {
    await removeExpense({
      variables: {
        input: { id },
      },
    });
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
        <Button type="submit" disabled={adding}>
          {adding ? 'Adding...' : 'Add expense'}
        </Button>
      </Form>

      {data?.expenses.length ? (
        <List>
          {data.expenses.map((expense) => (
            <ListItem key={expense.id}>
              <strong>{expense.title}</strong> - {expense.amount.toFixed(2)} DKK
              <DeleteButton
                type="button"
                onClick={() => handleDelete(expense.id)}
                disabled={deleting}
              >
                Delete
              </DeleteButton>
            </ListItem>
          ))}
        </List>
      ) : (
        <p>No expenses yet.</p>
      )}
    </Page>
  );
}

export default App;
