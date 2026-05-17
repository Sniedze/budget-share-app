import { Sidebar } from '../components/sections/Sidebar';
import { AppLayout, MutedText, PageSurface } from '../components/ui';
import { spacing } from '../styles/tokens';
import {
  BudgetCategoryList,
  BudgetDetailedViews,
  BudgetForecastCharts,
  BudgetMonthlyOverview,
  BudgetPageHeader,
  BudgetSettingsModal,
  BudgetSummaryCards,
} from '../features/budget/components';
import { useBudgetPageState } from '../features/budget';

export const BudgetPage = (): JSX.Element => {
  const state = useBudgetPageState();

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        <BudgetPageHeader onOpenBudgetModal={state.openBudgetModal} />

        {state.loading ? <MutedText>Loading…</MutedText> : null}
        {state.error ? <MutedText>Error: {state.error.message}</MutedText> : null}

        {state.mixedCurrencyWarning ? (
          <MutedText style={{ marginBottom: spacing.md }}>
            This year includes expenses in more than one currency. Totals and charts use {state.budgetCurrency} only;
            other currencies still appear in recent transactions.
          </MutedText>
        ) : null}

        <BudgetSummaryCards
          formatAmount={state.formatBudgetAmount}
          balanceNow={state.balanceNow}
          balanceDeltaYtd={state.balanceDeltaYtd}
          projectedEnd={state.projectedEnd}
          ytdIncCombined={state.ytdIncCombined}
          ytdIncomingActual={state.ytdIncomingActual}
          ytdIncEstimate={state.ytdIncEstimate}
          ytdExp={state.ytdExp}
          now={state.now}
        />

        <BudgetMonthlyOverview
          formatAmount={state.formatBudgetAmount}
          viewYear={state.viewYear}
          viewMonthIndex={state.viewMonthIndex}
          monthPickerValue={state.monthPickerValue}
          onMonthPickerChange={state.onMonthPickerChange}
          totalBudgeted={state.totalBudgeted}
          totalSpentMonth={state.totalSpentMonth}
          remainingBudget={state.remainingBudget}
          usagePct={state.usagePct}
        />

        <BudgetDetailedViews
          formatAmount={state.formatBudgetAmount}
          detailTab={state.detailTab}
          setDetailTab={state.setDetailTab}
          viewYear={state.viewYear}
          sortedRecentTx={state.sortedRecentTx}
          monthlyBreakdown={state.monthlyBreakdownDetail}
          categoryTrends={state.categoryTrendsTable}
        />

        <BudgetForecastCharts
          formatAmount={state.formatBudgetAmount}
          chartTab={state.chartTab}
          setChartTab={state.setChartTab}
          chartRowsMonthly={state.chartRowsMonthly}
          yearTotals={state.yearTotals}
        />

        <BudgetCategoryList formatAmount={state.formatBudgetAmount} categoryRows={state.categoryRows} />

        {state.budgetModalOpen ? (
          <BudgetSettingsModal
            monthKey={state.monthKey}
            categories={state.categories}
            draftAssumptions={state.draftAssumptions}
            setDraftAssumptions={state.setDraftAssumptions}
            draftCategoryBudgets={state.draftCategoryBudgets}
            setDraftCategoryBudgets={state.setDraftCategoryBudgets}
            onClose={() => state.setBudgetModalOpen(false)}
            onSave={state.onSaveBudgets}
          />
        ) : null}
      </PageSurface>
    </AppLayout>
  );
};
