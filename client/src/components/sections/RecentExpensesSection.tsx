import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import type { Expense } from '../../features/expenses';
import { formatAppCurrency } from '../../format/currency';
import { splitExpenseTitleForDisplay } from '../../format/expenseTitle';
import { colors, radii, spacing } from '../../styles/tokens';
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

const Footer = styled.div`
  margin-top: ${spacing.md};
  display: flex;
  justify-content: center;
`;

const TabBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing.sm};
  margin-bottom: ${spacing.md};
  padding: ${spacing.xs};
  border: 1px solid ${colors.border};
  border-radius: ${radii.md};
  background: ${colors.surface};
  max-width: 100%;
  overflow-x: auto;
`;

const TabButton = styled.button<{ $isActive: boolean }>`
  border: 0;
  cursor: pointer;
  border-radius: ${radii.sm};
  padding: ${spacing.sm} ${spacing.md};
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  color: ${({ $isActive }) => ($isActive ? '#ffffff' : colors.textMuted)};
  background: ${({ $isActive }) => ($isActive ? colors.primary : 'transparent')};

  &:hover {
    color: ${({ $isActive }) => ($isActive ? '#ffffff' : colors.textPrimary)};
  }
`;

const expenseMonthKey = (expense: Expense): string => expense.transactionDate.slice(0, 7);

const formatMonthTabLabel = (key: string): string => {
  const [yearStr, monthStr] = key.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) {
    return key;
  }
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
};

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
  const monthKeys = useMemo(() => {
    const keys = new Set<string>();
    expenses.forEach((expense) => {
      const key = expenseMonthKey(expense);
      if (key.length === 7) {
        keys.add(key);
      }
    });
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const [activeTab, setActiveTab] = useState<'recent' | string>('recent');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    if (activeTab !== 'recent' && !monthKeys.includes(activeTab)) {
      setActiveTab('recent');
    }
  }, [activeTab, monthKeys]);

  const tableRows = useMemo(() => {
    if (activeTab === 'recent') {
      return sortedExpenses.slice(0, visibleCount);
    }
    return sortedExpenses.filter((expense) => expenseMonthKey(expense) === activeTab);
  }, [activeTab, sortedExpenses, visibleCount]);

  if (!expenses.length) {
    return (
      <SectionCard>
        <Title>Recent Expenses</Title>
        <MutedText>No expenses yet.</MutedText>
      </SectionCard>
    );
  }

  const hasMoreRecent = activeTab === 'recent' && visibleCount < sortedExpenses.length;

  return (
    <SectionCard>
      <Title>Recent Expenses</Title>
      <TabBar role="tablist" aria-label="Expense list period">
        <TabButton
          type="button"
          role="tab"
          aria-selected={activeTab === 'recent'}
          $isActive={activeTab === 'recent'}
          onClick={() => {
            setActiveTab('recent');
            setVisibleCount(PAGE_SIZE);
          }}
        >
          Recent
        </TabButton>
        {monthKeys.map((key) => (
          <TabButton
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            $isActive={activeTab === key}
            onClick={() => setActiveTab(key)}
          >
            {formatMonthTabLabel(key)}
          </TabButton>
        ))}
      </TabBar>
      {tableRows.length === 0 ? (
        <MutedText>No expenses in this period.</MutedText>
      ) : (
        <TableWrapper>
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th>Merchant</Th>
                <Th>Description</Th>
                <Th>Category</Th>
                <Th>Amount</Th>
                <Th>Split</Th>
                <Th>Private</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <tbody>
              {tableRows.map((expense) => {
                const { merchant, description } = splitExpenseTitleForDisplay(expense.title);
                return (
                  <Tr key={expense.id}>
                    <Td>{formatDate(expense.transactionDate)}</Td>
                    <Td>{merchant}</Td>
                    <Td>{description || '—'}</Td>
                    <Td>
                      <Badge $variant="accent">{expense.category}</Badge>
                    </Td>
                    <Td>{formatAppCurrency(expense.amount)}</Td>
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
                );
              })}
            </tbody>
          </Table>
        </TableWrapper>
      )}
      {activeTab === 'recent' && (hasMoreRecent || visibleCount > PAGE_SIZE) ? (
        <Footer>
          <Actions>
            {hasMoreRecent ? (
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
