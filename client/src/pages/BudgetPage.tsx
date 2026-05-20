import { Sidebar } from '../components/sections/Sidebar';
import { AppLayout, MutedText, PageSurface } from '../components/ui';
import { spacing } from '../styles/tokens';
import { BudgetFinancialShell } from '../features/budget/components';
import { useBudgetPageState } from '../features/budget';

export const BudgetPage = (): JSX.Element => {
  const state = useBudgetPageState();

  return (
    <AppLayout>
      <Sidebar />
      <PageSurface>
        {state.loading ? <MutedText>Loading…</MutedText> : null}
        {state.error ? <MutedText>Error: {state.error.message}</MutedText> : null}

        {state.mixedCurrencyWarning ? (
          <MutedText style={{ marginBottom: spacing.md }}>
            This year includes expenses in more than one currency. Totals and charts use {state.budgetCurrency} only;
            other currencies still appear in recent transactions.
            {state.indicativeYtdExpenses !== null ? (
              <>
                {' '}
                Indicative year-to-date spend in all currencies (ECB rates → DKK):{' '}
                {state.formatIndicativeAppAmount(state.indicativeYtdExpenses)}.
              </>
            ) : null}
          </MutedText>
        ) : null}

        <BudgetFinancialShell
          mainTab={state.mainTab}
          setMainTab={state.setMainTab}
          shiftViewMonth={state.shiftViewMonth}
          monthPickerValue={state.monthPickerValue}
          onMonthPickerChange={state.onMonthPickerChange}
          formatAmount={state.formatBudgetAmount}
          budgetCurrency={state.budgetCurrency}
          monthIncomeDisplay={state.monthIncomeDisplay}
          totalSpentMonth={state.totalSpentMonth}
          totalBudgeted={state.totalBudgeted}
          monthSaved={state.monthSaved}
          savingsRatePct={state.savingsRatePct}
          categoryRows={state.categoryRows}
          sortedRecentTx={state.sortedRecentTx}
          budgetInsights={state.budgetInsights}
          txSearch={state.txSearch}
          setTxSearch={state.setTxSearch}
          txCategoryFilter={state.txCategoryFilter}
          setTxCategoryFilter={state.setTxCategoryFilter}
          filteredTransactions={state.filteredTransactions}
          categories={state.categories}
          budgetAssumptions={state.assumptions}
          categoryBudgetLimits={state.categoryBudgetLimits}
          draftAssumptions={state.draftAssumptions}
          setDraftAssumptions={state.setDraftAssumptions}
          draftCategoryBudgets={state.draftCategoryBudgets}
          setDraftCategoryBudgets={state.setDraftCategoryBudgets}
          onSaveBudgets={state.onSaveBudgets}
          onResetBudgetSetup={state.onResetBudgetSetup}
          savingBudget={state.savingBudget}
          resettingBudget={state.resettingBudget}
          budgetSaveFeedback={state.budgetSaveFeedback}
          clearBudgetSaveFeedback={state.clearBudgetSaveFeedback}
          annualBudgetTotal={state.annualBudgetTotal}
          projectedEnd={state.projectedEnd}
          balanceNow={state.balanceNow}
          chartTab={state.chartTab}
          setChartTab={state.setChartTab}
          chartRowsMonthly={state.chartRowsMonthly}
          yearTotals={state.yearTotals}
          addBudgetCustomCategory={state.addBudgetCustomCategory}
          expenseCategoriesForMapping={state.expenseCategoriesForMapping}
          budgetLinesForMapping={state.budgetLinesForMapping}
          setExpenseCategoryMapping={state.setExpenseCategoryMapping}
          getExpenseCategoryMappingValue={state.getExpenseCategoryMappingValue}
          resolveExpenseToBudgetCategory={state.resolveExpenseToBudgetCategory}
          onSaveCategoryMappings={state.onSaveCategoryMappings}
          savingCategoryMappings={state.savingCategoryMappings}
          categoryMappingsDirty={state.categoryMappingsDirty}
          categoryMappingsFeedback={state.categoryMappingsFeedback}
          goals={state.goals}
          persistGoals={state.persistGoals}
          last6MonthsReport={state.last6MonthsReport}
          reportsAvgMonthlySpend={state.reportsAvgMonthlySpend}
          reportsAvgSavingsRate={state.reportsAvgSavingsRate}
          reportsMostOverspent={state.reportsMostOverspent}
          reportsTopCategories={state.reportsTopCategories}
        />
      </PageSurface>
    </AppLayout>
  );
};
