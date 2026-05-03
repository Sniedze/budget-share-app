import { Fragment, useState } from 'react';
import styled from 'styled-components';
import type { MonthlyOverviewPoint } from '../../features/expenses';
import { formatAppCurrency } from '../../format/currency';
import { colors, spacing } from '../../styles/tokens';
import { Card, MutedText } from '../ui';

type MonthlyOverviewSectionProps = {
  rows: MonthlyOverviewPoint[];
};

const SectionCard = styled(Card)`
  margin-bottom: ${spacing.xl};
`;

const Title = styled.h3`
  margin: 0 0 ${spacing.md};
  font-size: 16px;
  color: ${colors.textPrimary};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const HeadCell = styled.th`
  text-align: left;
  font-size: 12px;
  color: ${colors.textMuted};
  font-weight: 600;
  padding: ${spacing.sm} ${spacing.xs};
  border-bottom: 1px solid ${colors.border};
`;

const Cell = styled.td`
  font-size: 14px;
  color: ${colors.textPrimary};
  padding: ${spacing.sm} ${spacing.xs};
  border-bottom: 1px solid ${colors.border};
`;

const SummaryRow = styled.tr`
  cursor: pointer;
  transition: background 0.15s ease-in-out;

  &:hover {
    background: #eef2ff;
  }
`;

const ExpandedCell = styled.td`
  padding: ${spacing.sm} ${spacing.xs} ${spacing.md};
  border-bottom: 1px solid ${colors.border};
  background: #f8fafc;
`;

const CategoryList = styled.div`
  display: grid;
  gap: 4px;
`;

export const MonthlyOverviewSection = ({ rows }: MonthlyOverviewSectionProps): JSX.Element => {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const toggleExpanded = (month: string) => {
    setExpandedMonth((previous) => (previous === month ? null : month));
  };

  return (
    <SectionCard>
      <Title>Monthly Overview</Title>
      {rows.length === 0 ? (
        <MutedText>No monthly data yet.</MutedText>
      ) : (
        <Table>
          <thead>
            <tr>
              <HeadCell>Month</HeadCell>
              <HeadCell>Total</HeadCell>
              <HeadCell>Personal</HeadCell>
              <HeadCell>Shared</HeadCell>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.month}>
                <SummaryRow onClick={() => toggleExpanded(row.month)}>
                  <Cell>{row.month}</Cell>
                  <Cell>{formatAppCurrency(row.total)}</Cell>
                  <Cell>{formatAppCurrency(row.personal)}</Cell>
                  <Cell>{formatAppCurrency(row.shared)}</Cell>
                </SummaryRow>
                {expandedMonth === row.month ? (
                  <tr>
                    <ExpandedCell colSpan={4}>
                      <CategoryList>
                        {row.categories.map((entry) => (
                          <MutedText key={`${row.month}-${entry.name}`}>
                            {entry.name}: {formatAppCurrency(entry.total)}
                          </MutedText>
                        ))}
                      </CategoryList>
                    </ExpandedCell>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </SectionCard>
  );
};
