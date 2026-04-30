import { useMemo, useState } from 'react';
import styled from 'styled-components';
import type { Expense } from '../../features/expenses';
import {
 colors, spacing 
} from '../../styles/tokens';
import {
 Badge, Button, Card, MutedText, Table, TableWrapper, Td, Th, Thead, Tr 
} from '../ui';

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

const Footer = styled.div`
  margin-top: ${spacing.md};
  display: flex;
  justify-content: center;
`;

const formatDate = (value: string): string => new Date(value).toISOString().slice(0, 10);

const formatSplitLabel = (expense: Expense): string => {
  if (expense.split !== 'Custom' || expense.splitDetails.length === 0) {
    return expense.split;
  }

  const preview = expense.splitDetails
    .slice(0, 2)
    .map((detail) => `${detail.participant}: ${detail.ratio}%`)
    .join(', ');
  return expense.splitDetails.length > 2 ? `${preview}, ...` : preview;
};

export const RecentExpensesSection = ({
  expenses,
  isMutating,
  onEdit,
  onDelete,
}: RecentExpensesSectionProps): JSX.Element => {
  const PAGE_SIZE = 8;
  const sortedExpenses = useMemo(
    () => [...expenses].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)),
    [expenses],
  );
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!expenses.length) {
    return (
      <SectionCard>
        <Title>Recent Expenses</Title>
        <MutedText>No expenses yet.</MutedText>
      </SectionCard>
    );
  }

  const visibleExpenses = sortedExpenses.slice(0, visibleCount);
  const hasMore = visibleCount < sortedExpenses.length;

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
              <Th>Private</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <tbody>
            {visibleExpenses.map((expense) => (
              <Tr key={expense.id}>
                <Td>{formatDate(expense.transactionDate)}</Td>
                <Td>{expense.title}</Td>
                <Td>
                  <Badge $variant="accent">{expense.category}</Badge>
                </Td>
                <Td>${expense.amount.toFixed(2)}</Td>
                <Td>{formatSplitLabel(expense)}</Td>
                <Td>{expense.isPrivate && expense.groupId ? 'Yes' : '—'}</Td>
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
      {hasMore || visibleCount > PAGE_SIZE ? (
        <Footer>
          <Actions>
            {hasMore ? (
              <Button
                type="button"
                $variant="secondary"
                onClick={() => setVisibleCount((previous) => previous + PAGE_SIZE)}
                disabled={isMutating}
              >
                Load more
              </Button>
            ) : null}
            {visibleCount > PAGE_SIZE ? (
              <Button
                type="button"
                $variant="secondary"
                onClick={() => setVisibleCount(PAGE_SIZE)}
                disabled={isMutating}
              >
                See less
              </Button>
            ) : null}
          </Actions>
        </Footer>
      ) : null}
    </SectionCard>
  );
};
