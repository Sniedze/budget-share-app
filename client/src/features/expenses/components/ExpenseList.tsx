import type { Expense } from '../types';
import styled from 'styled-components';
import { Button, MutedText } from '../../../components/ui';
import { formatAppCurrency } from '../../../format/currency';

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
  flex-direction: column;
  gap: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
`;

const Main = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  color: #6b7280;
  font-size: 14px;
`;

const Actions = styled.div`
  display: flex;
  gap: 8px;
`;

type ExpenseListProps = {
  expenses: Expense[];
  isMutating: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
};

const formatDate = (value: string): string => {
  return new Date(value).toLocaleDateString();
};

export const ExpenseList = ({
  expenses,
  isMutating,
  onEdit,
  onDelete,
}: ExpenseListProps): JSX.Element => {
  if (!expenses.length) {
    return <MutedText>No expenses yet.</MutedText>;
  }

  return (
    <List>
      {expenses.map((expense) => (
        <ListItem key={expense.id}>
          <Main>
            <strong>{expense.title}</strong>
            <span>{formatAppCurrency(expense.amount)}</span>
          </Main>
          <Meta>
            <span>Transaction: {formatDate(expense.transactionDate)}</span>
            <span>Created: {formatDate(expense.createdAt)}</span>
          </Meta>
          <Actions>
            <Button $variant="primary" type="button" onClick={() => onEdit(expense)} disabled={isMutating}>
              Edit
            </Button>
            <Button $variant="danger" type="button" onClick={() => onDelete(expense.id)} disabled={isMutating}>
              Delete
            </Button>
          </Actions>
        </ListItem>
      ))}
    </List>
  );
};
