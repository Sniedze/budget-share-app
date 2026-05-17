import { AlertTriangle } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAppCurrency } from '../../../format/currency';
import { colors } from '../../../styles/tokens';
import type { ForecastChartRow } from '../selectors';
import { Callout, ChartCard, ChartFrame, OverviewTitle, PillTab, PillTabs, SectionHead } from '../budgetPageStyles';

type YearTotalRow = {
  year: number;
  spent: number;
  budget: number;
};

type BudgetForecastChartsProps = {
  formatAmount?: import('../budgetPageTypes').FormatBudgetAmount;
  chartTab: 'monthly' | 'yearly';
  setChartTab: (tab: 'monthly' | 'yearly') => void;
  chartRowsMonthly: ForecastChartRow[];
  yearTotals: YearTotalRow[];
};

export const BudgetForecastCharts = ({
  formatAmount = formatAppCurrency,
  chartTab,
  setChartTab,
  chartRowsMonthly,
  yearTotals,
}: BudgetForecastChartsProps): JSX.Element => {
  return (
    <ChartCard>
      <SectionHead>
        <OverviewTitle style={{ margin: 0 }}>Spending forecast &amp; trends</OverviewTitle>
        <PillTabs>
          <PillTab type="button" $active={chartTab === 'monthly'} onClick={() => setChartTab('monthly')}>
            Monthly view
          </PillTab>
          <PillTab type="button" $active={chartTab === 'yearly'} onClick={() => setChartTab('yearly')}>
            Yearly projection
          </PillTab>
        </PillTabs>
      </SectionHead>

      {chartTab === 'monthly' ? (
        <>
          <ChartFrame>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartRowsMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => (value == null ? '—' : formatAmount(Number(value)))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="budget"
                  name="Budget"
                  stroke={colors.chartStrokeLight}
                  fill={colors.chartFillLight}
                  fillOpacity={0.5}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke={colors.chartStroke}
                  fill={colors.chartFill}
                  fillOpacity={0.35}
                  strokeWidth={2}
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="forecast"
                  name="Forecast"
                  stroke={colors.chartAccent}
                  fill={colors.chartAccentFill}
                  fillOpacity={0.3}
                  strokeWidth={2}
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
          <Callout>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            <div>
              <strong>Forecast methodology.</strong> Projections use your average spend in months so far this year;
              actual results may vary. Set a monthly income estimate in &quot;Set budget&quot; to improve balance
              projections.
            </div>
          </Callout>
        </>
      ) : (
        <>
          <ChartFrame>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={yearTotals}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.chartGrid} />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatAmount(Number(value ?? 0))} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="spent"
                  name="Total spent"
                  stroke={colors.chartStroke}
                  fill={colors.chartFill}
                  fillOpacity={0.45}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="budget"
                  name="Annual budget (12× current month)"
                  stroke={colors.chartMutedStroke}
                  fill={colors.chartMutedFill}
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartFrame>
          <Callout>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
            <div>
              Annual budget line uses twelve times your <strong>currently selected month&apos;s</strong> total
              category budget as a rough yardstick—not a full year of stored budgets per month.
            </div>
          </Callout>
        </>
      )}
    </ChartCard>
  );
};
