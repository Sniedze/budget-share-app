import styled from 'styled-components';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BreakdownPoint, TrendPoint } from '../../features/expenses';
import { colors, spacing } from '../../styles/tokens';
import { Card, SectionSubtitle } from '../ui';

type ChartsSectionProps = {
  trendData: TrendPoint[];
  breakdownData: BreakdownPoint[];
};

const Row = styled.section`
  display: flex;
  gap: ${spacing.md};
  margin-bottom: ${spacing.xl};
  flex-wrap: wrap;
`;

const ChartCard = styled(Card)`
  min-height: 220px;
`;

const TrendCard = styled(ChartCard)`
  flex: 2 1 420px;
`;

const BreakdownCard = styled(ChartCard)`
  flex: 1 1 260px;
`;

const CardTitle = styled.h3`
  margin: 0 0 ${spacing.md};
  font-size: 14px;
  color: ${colors.textPrimary};
`;

const ChartFrame = styled.div`
  position: relative;
  height: 165px;
  border: 1px solid #f0f2f5;
  border-radius: 8px;
  background: ${colors.surface};
  overflow: hidden;
`;

const PieFrame = styled.div`
  height: 165px;
`;

const Legend = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${spacing.sm};
  font-size: 12px;
  color: ${colors.textMuted};
`;

const LegendItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
`;

const Dot = styled.span<{ $color: string }>`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${({ $color }) => $color};
`;

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

const formatAmount = (value: number): string => `$${value.toFixed(2)}`;

export const ChartsSection = ({ trendData, breakdownData }: ChartsSectionProps): JSX.Element => {
  return (
    <Row>
      <TrendCard>
        <CardTitle>Monthly Spending Trend</CardTitle>
        <ChartFrame>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendData} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: colors.textMuted, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: colors.textMuted, fontSize: 12 }}
                tickFormatter={(value: number) => `$${Math.round(value)}`}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip formatter={(value) => formatAmount(Number(value ?? 0))} />
              <Bar dataKey="amount" fill={colors.accent} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </TrendCard>

      <BreakdownCard>
        <CardTitle>Category Breakdown</CardTitle>
        <PieFrame>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(value) => formatAmount(Number(value ?? 0))} />
              <Pie data={breakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={62} paddingAngle={1}>
                {breakdownData.map((entry, index) => (
                  <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </PieFrame>
        <Legend>
          {breakdownData.map((entry, index) => (
            <LegendItem key={entry.name}>
              <Dot $color={PIE_COLORS[index % PIE_COLORS.length]} />
              {entry.name}
            </LegendItem>
          ))}
        </Legend>
        <SectionSubtitle>Distribution by spending categories</SectionSubtitle>
      </BreakdownCard>
    </Row>
  );
};
