import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { MutedText, Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from '../../../components/ui';
import { formatAppCurrency } from '../../../format/currency';
import type { MonthlyBreakdownRow, MonthlyBreakdownTotals } from '../budgetPageTypes';
import { StatusPill } from '../budgetPageStyles';

type BudgetMonthlyBreakdownTableProps = {
  formatAmount?: import('../budgetPageTypes').FormatBudgetAmount;
  viewYear: number;
  rows: MonthlyBreakdownRow[];
  totals: MonthlyBreakdownTotals | null;
};

export const BudgetMonthlyBreakdownTable = ({
  formatAmount = formatAppCurrency,
  viewYear,
  rows,
  totals,
}: BudgetMonthlyBreakdownTableProps): JSX.Element => {
  return (
    <TableWrapper>
      <Table>
        <Thead>
          <Tr>
            <Th>Month</Th>
            <Th style={{ textAlign: 'right' }}>Income</Th>
            <Th style={{ textAlign: 'right' }}>Expenses</Th>
            <Th style={{ textAlign: 'right' }}>Budget</Th>
            <Th style={{ textAlign: 'right' }}>Variance</Th>
            <Th style={{ textAlign: 'right' }}>Savings</Th>
            <Th>Status</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <Tr key={row.key}>
              <Td>
                {row.label} {viewYear}
                {row.isProjected ? (
                  <MutedText as="span" style={{ marginLeft: 6, fontSize: 11 }}>
                    (projected)
                  </MutedText>
                ) : null}
              </Td>
              <Td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                +{formatAmount(row.income)}
              </Td>
              <Td style={{ textAlign: 'right' }}>
                {row.expenses === null ? '—' : formatAmount(row.expenses)}
              </Td>
              <Td style={{ textAlign: 'right' }}>{row.budget > 0 ? formatAmount(row.budget) : '—'}</Td>
              <Td style={{ textAlign: 'right' }}>
                {row.variance === null ? (
                  '—'
                ) : (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 4,
                      fontWeight: 600,
                      color: row.variance >= 0 ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {row.variance >= 0 ? <ArrowDownRight size={16} aria-hidden /> : <ArrowUpRight size={16} aria-hidden />}
                    {formatAmount(Math.abs(row.variance))}
                  </span>
                )}
              </Td>
              <Td style={{ textAlign: 'right' }}>{row.savings === null ? '—' : formatAmount(row.savings)}</Td>
              <Td>
                {row.status === 'under' ? (
                  <StatusPill $variant="under">Under budget</StatusPill>
                ) : row.status === 'over' ? (
                  <StatusPill $variant="over">Over budget</StatusPill>
                ) : (
                  <MutedText as="span">—</MutedText>
                )}
              </Td>
            </Tr>
          ))}
          {totals ? (
            <Tr style={{ fontWeight: 700, background: '#f8fafc' }}>
              <Td>Total (actual)</Td>
              <Td style={{ textAlign: 'right', color: '#16a34a' }}>
                +{formatAmount(totals.income)}
              </Td>
              <Td style={{ textAlign: 'right' }}>{formatAmount(totals.expenses)}</Td>
              <Td style={{ textAlign: 'right' }}>{formatAmount(totals.budget)}</Td>
              <Td>—</Td>
              <Td style={{ textAlign: 'right' }}>{formatAmount(totals.savings)}</Td>
              <Td>—</Td>
            </Tr>
          ) : null}
        </Tbody>
      </Table>
    </TableWrapper>
  );
};
