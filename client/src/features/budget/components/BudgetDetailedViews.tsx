import type { CategoryTrendRow, MonthlyBreakdownRow, MonthlyBreakdownTotals, RecentTransactionRow } from '../budgetPageTypes';
import { DetailedSection, OverviewTitle, PillTab, PillTabs, SectionHead } from '../budgetPageStyles';
import { BudgetCategoryTrendsTable } from './BudgetCategoryTrendsTable';
import { BudgetMonthlyBreakdownTable } from './BudgetMonthlyBreakdownTable';
import { BudgetRecentTransactionsTable } from './BudgetRecentTransactionsTable';

type BudgetDetailedViewsProps = {
  formatAmount?: import('../budgetPageTypes').FormatBudgetAmount;
  detailTab: 'recent' | 'months' | 'trends';
  setDetailTab: (tab: 'recent' | 'months' | 'trends') => void;
  viewYear: number;
  sortedRecentTx: RecentTransactionRow[];
  monthlyBreakdown: { rows: MonthlyBreakdownRow[]; totals: MonthlyBreakdownTotals | null };
  categoryTrends: {
    monthIndices: number[];
    labels: string[];
    rows: CategoryTrendRow[];
    columnTotals: number[];
  };
};

export const BudgetDetailedViews = ({
  formatAmount,
  detailTab,
  setDetailTab,
  viewYear,
  sortedRecentTx,
  monthlyBreakdown,
  categoryTrends,
}: BudgetDetailedViewsProps): JSX.Element => {
  return (
    <DetailedSection>
      <SectionHead>
        <OverviewTitle style={{ margin: 0 }}>Detailed views</OverviewTitle>
        <PillTabs>
          <PillTab type="button" $active={detailTab === 'recent'} onClick={() => setDetailTab('recent')}>
            Recent transactions
          </PillTab>
          <PillTab type="button" $active={detailTab === 'months'} onClick={() => setDetailTab('months')}>
            Monthly breakdown
          </PillTab>
          <PillTab type="button" $active={detailTab === 'trends'} onClick={() => setDetailTab('trends')}>
            Category trends
          </PillTab>
        </PillTabs>
      </SectionHead>

      {detailTab === 'recent' ? <BudgetRecentTransactionsTable rows={sortedRecentTx} /> : null}
      {detailTab === 'months' ? (
        <BudgetMonthlyBreakdownTable
          formatAmount={formatAmount}
          viewYear={viewYear}
          rows={monthlyBreakdown.rows}
          totals={monthlyBreakdown.totals}
        />
      ) : null}
      {detailTab === 'trends' ? (
        <BudgetCategoryTrendsTable
          formatAmount={formatAmount}
          viewYear={viewYear}
          monthIndices={categoryTrends.monthIndices}
          labels={categoryTrends.labels}
          rows={categoryTrends.rows}
          columnTotals={categoryTrends.columnTotals}
        />
      ) : null}
    </DetailedSection>
  );
};
