import { MutedText, Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from '../../../components/ui';
import { formatCurrency } from '../../../format/currency';
import type { RecentTransactionRow } from '../budgetPageTypes';
import { Pill } from '../budgetPageStyles';

type BudgetRecentTransactionsTableProps = {
  rows: RecentTransactionRow[];
};

export const BudgetRecentTransactionsTable = ({ rows }: BudgetRecentTransactionsTableProps): JSX.Element => {
  return (
    <TableWrapper>
      <Table>
        <Thead>
          <Tr>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th>Flow</Th>
            <Th>Category</Th>
            <Th style={{ textAlign: 'right' }}>Amount</Th>
            <Th style={{ textAlign: 'right' }}>Budget impact</Th>
            <Th style={{ textAlign: 'right' }}>Remaining</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.length === 0 ? (
            <Tr>
              <Td colSpan={7}>
                <MutedText>No transactions in this month.</MutedText>
              </Td>
            </Tr>
          ) : (
            rows.map(({ expense, remaining }) => {
              const isIn = expense.flow === 'Incoming';
              return (
                <Tr key={expense.id}>
                  <Td>{expense.transactionDate.slice(0, 10)}</Td>
                  <Td>{expense.title}</Td>
                  <Td>
                    <Pill>{isIn ? 'Incoming' : 'Outgoing'}</Pill>
                  </Td>
                  <Td>
                    <Pill>{expense.category}</Pill>
                  </Td>
                  <Td style={{ textAlign: 'right' }}>{formatCurrency(expense.amount, expense.currency)}</Td>
                  <Td style={{ textAlign: 'right', color: isIn ? '#16a34a' : '#dc2626' }}>
                    {isIn ? '+' : '-'}
                    {formatCurrency(expense.amount, expense.currency)}
                  </Td>
                  <Td
                    style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      color: remaining >= 0 ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {formatCurrency(remaining, expense.currency)}
                  </Td>
                </Tr>
              );
            })
          )}
        </Tbody>
      </Table>
    </TableWrapper>
  );
};
