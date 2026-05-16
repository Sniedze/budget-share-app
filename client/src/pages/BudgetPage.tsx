import { Sidebar } from '../components/sections/Sidebar';
import { AppLayout, MutedText, PageSurface } from '../components/ui';
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

        <BudgetSummaryCards
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
          detailTab={state.detailTab}
          setDetailTab={state.setDetailTab}
          viewYear={state.viewYear}
          sortedRecentTx={state.sortedRecentTx}
          monthlyBreakdown={state.monthlyBreakdownDetail}
          categoryTrends={state.categoryTrendsTable}
        />

        <BudgetForecastCharts
          chartTab={state.chartTab}
          setChartTab={state.setChartTab}
          chartRowsMonthly={state.chartRowsMonthly}
          yearTotals={state.yearTotals}
        />

        <BudgetCategoryList categoryRows={state.categoryRows} />

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
