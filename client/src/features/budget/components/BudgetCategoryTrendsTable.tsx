import { TrendingUp } from 'lucide-react';
import { MutedText, Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from '../../../components/ui';
import { formatAppCurrency } from '../../../format/currency';
import { colors } from '../../../styles/tokens';
import { CATEGORY_DOT_COLORS } from '../budgetPageStyles';
import type { CategoryTrendRow } from '../budgetPageTypes';
import { Dot, MiniTrend } from '../budgetPageStyles';

type BudgetCategoryTrendsTableProps = {
  formatAmount?: import('../budgetPageTypes').FormatBudgetAmount;
  viewYear: number;
  monthIndices: number[];
  labels: string[];
  rows: CategoryTrendRow[];
  columnTotals: number[];
};

export const BudgetCategoryTrendsTable = ({
  formatAmount = formatAppCurrency,
  viewYear,
  monthIndices,
  labels,
  rows,
  columnTotals,
}: BudgetCategoryTrendsTableProps): JSX.Element => {
  if (rows.length === 0) {
    return <MutedText>Add outgoing expenses to see category trends for {viewYear}.</MutedText>;
  }

  return (
    <TableWrapper>
      <Table>
        <Thead>
          <Tr>
            <Th>Category</Th>
            {labels.map((lab) => (
              <Th key={lab} style={{ textAlign: 'right' }}>
                {lab}
              </Th>
            ))}
            <Th style={{ textAlign: 'right' }}>Budget</Th>
            <Th style={{ textAlign: 'right' }}>YTD total</Th>
            <Th style={{ textAlign: 'right' }}>Avg / month</Th>
            <Th>Trend</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((r, idx) => (
            <Tr key={r.cat}>
              <Td>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Dot $color={CATEGORY_DOT_COLORS[idx % CATEGORY_DOT_COLORS.length]} aria-hidden />
                  {r.cat}
                </span>
              </Td>
              {r.monthAmounts.map((amt, i) => (
                <Td key={`${r.cat}-${monthIndices[i]}`} style={{ textAlign: 'right' }}>
                  {formatAmount(amt)}
                </Td>
              ))}
              <Td style={{ textAlign: 'right' }}>{r.cap > 0 ? formatAmount(r.cap) : '—'}</Td>
              <Td style={{ textAlign: 'right', color: colors.primary, fontWeight: 600 }}>
                {formatAmount(r.ytd)}
              </Td>
              <Td
                style={{
                  textAlign: 'right',
                  fontWeight: 600,
                  color: r.cap > 0 && r.avg > r.cap ? colors.amountNegative : colors.amountPositive,
                }}
              >
                {formatAmount(r.avg)}
              </Td>
              <Td>
                <MiniTrend $trend={r.trend}>
                  {r.trend === 'up' ? <TrendingUp size={14} aria-hidden /> : null}
                  {r.trend === 'up' ? 'Rising' : r.trend === 'down' ? 'Falling' : 'Stable'}
                </MiniTrend>
              </Td>
            </Tr>
          ))}
          <Tr style={{ fontWeight: 700, background: colors.tableHeaderBg }}>
            <Td>Total</Td>
            {columnTotals.map((t, i) => (
              <Td key={`tot-${monthIndices[i]}`} style={{ textAlign: 'right' }}>
                {formatAmount(t)}
              </Td>
            ))}
            <Td>—</Td>
            <Td style={{ textAlign: 'right', color: colors.primary }}>
              {formatAmount(rows.reduce((s, r) => s + r.ytd, 0))}
            </Td>
            <Td>—</Td>
            <Td>—</Td>
          </Tr>
        </Tbody>
      </Table>
    </TableWrapper>
  );
};
