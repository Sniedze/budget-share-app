import styled from 'styled-components';
import type { Expense } from '../../features/expenses';
import { colors, spacing } from '../../styles/tokens';
import { Badge, Button, Card, MutedText, Table, TableWrapper, Td, Th, Thead, Tr } from '../ui';

type RecentExpensesSectionProps = {
  expenses: Expense[];
  isMutating: boolean;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
};

const SectionCard = styled(Card)`
  margin-top: ${spacing.xl};
`;

const Title = styled.h3`
  margin: 0 0 ${spacing.md};
  font-size: 16px;
  color: ${colors.textPrimary};
`;

const Actions = styled.div`
  display: flex;
  gap: ${spacing.sm};
`;

const getCategory = (title: string): string => {
  const value = title.toLowerCase();
  if (value.includes('food') || value.includes('grocery')) return 'Groceries';
  if (value.includes('uber') || value.includes('taxi') || value.includes('bus')) return 'Transportation';
  if (value.includes('doctor') || value.includes('pharmacy')) return 'Healthcare';
  return 'General';
};

const formatDate = (value: string): string => new Date(value).toISOString().slice(0, 10);

export const RecentExpensesSection = ({
  expenses,
  isMutating,
  onEdit,
  onDelete,
}: RecentExpensesSectionProps): JSX.Element => {
  if (!expenses.length) {
    return (
      <SectionCard>
        <Title>Recent Expenses</Title>
        <MutedText>No expenses yet.</MutedText>
      </SectionCard>
    );
  }

  const recent = [...expenses]
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .slice(0, 8);

  return (
    <SectionCard>
      <Title>Recent Expenses</Title>
      <TableWrapper>
        <Table>
          <Thead>
            <tr>
              <Th>Date</Th>
              <Th>Description</Th>
              <Th>Category</Th>
              <Th>Amount</Th>
              <Th>Split</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <tbody>
            {recent.map((expense, index) => (
              <Tr key={expense.id}>
                <Td>{formatDate(expense.transactionDate)}</Td>
                <Td>{expense.title}</Td>
                <Td>
                  <Badge $variant="accent">{getCategory(expense.title)}</Badge>
                </Td>
                <Td>${expense.amount.toFixed(2)}</Td>
                <Td>{index % 2 === 0 ? 'Personal' : 'Shared'}</Td>
                <Td>
                  <Actions>
                    <Button
                      type="button"
                      $variant="primary"
                      $size="sm"
                      onClick={() => onEdit(expense)}
                      disabled={isMutating}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      $variant="danger"
                      $size="sm"
                      onClick={() => onDelete(expense.id)}
                      disabled={isMutating}
                    >
                      Delete
                    </Button>
                  </Actions>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>
    </SectionCard>
  );
};
