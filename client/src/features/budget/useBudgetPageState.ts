import { useQuery } from '@apollo/client/react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import {
  buildForecastChartRows,
  categorySpendTrend,
  collectCategories,
  currentEstimatedBalance,
  dominantExpenseCurrency,
  expenseDateParts,
  filterExpensesByCurrency,
  filterExpensesInMonth,
  filterIncomingExpensesInMonth,
  filterOutgoingExpensesInMonth,
  hasMixedExpenseCurrencies,
  monthlyActualTotals,
  projectedYearEndBalance,
  suggestMonthBudgetsFromPreviousMonth,
  sumByCategory,
  sumExpenseAmounts,
  toYearMonthKey,
  totalSpendByYear,
  yearsPresentInExpenses,
  ytdExpensesThrough,
  ytdIncomingThrough,
  ytdIncomeFromMonthlyEstimate,
  pad2,
} from './selectors';
import { formatCurrency } from '../../format/currency';
import { useUserWorkspaceSettings } from '../userSettings';
import type { BudgetAssumptions } from './storage';
import { CATEGORY_DOT_COLORS, DEFAULT_CATEGORY_OPTIONS } from './budgetPageStyles';
import type { CategoryTrendRow, MonthlyBreakdownRow, MonthlyBreakdownTotals } from './budgetPageTypes';
import {
  GET_EXPENSES,
  toBudgetTopLevelCategory,
  type GetExpensesResponse,
} from '../expenses';

export const useBudgetPageState = () => {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonthIndex, setViewMonthIndex] = useState(now.getMonth());
  const [detailTab, setDetailTab] = useState<'recent' | 'months' | 'trends'>('recent');
  const [chartTab, setChartTab] = useState<'monthly' | 'yearly'>('monthly');
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);

  const monthKey = toYearMonthKey(viewYear, viewMonthIndex);
  const {
    settings: workspaceSettings,
    loading: workspaceLoading,
    saveSettings,
  } = useUserWorkspaceSettings(userId, monthKey);

  const [draftAssumptions, setDraftAssumptions] = useState<BudgetAssumptions>({
    startingBalance: 0,
    monthlyIncomeEstimate: 0,
  });
  const [draftCategoryBudgets, setDraftCategoryBudgets] = useState<Record<string, string>>({});

  const { data, loading, error } = useQuery<GetExpensesResponse>(GET_EXPENSES);
  const expenses = useMemo(() => data?.expenses ?? [], [data]);

  const viewYearExpenses = useMemo(
    () =>
      expenses.filter((expense) => expenseDateParts(expense.transactionDate).year === viewYear),
    [expenses, viewYear],
  );
  const mixedCurrencyWarning = useMemo(
    () => hasMixedExpenseCurrencies(viewYearExpenses),
    [viewYearExpenses],
  );
  const budgetCurrency = useMemo(
    () => dominantExpenseCurrency(viewYearExpenses),
    [viewYearExpenses],
  );
  const budgetExpenses = useMemo(
    () => (mixedCurrencyWarning ? filterExpensesByCurrency(expenses, budgetCurrency) : expenses),
    [expenses, mixedCurrencyWarning, budgetCurrency],
  );
  const formatBudgetAmount = useCallback(
    (value: number) => formatCurrency(value, budgetCurrency),
    [budgetCurrency],
  );

  const categories = useMemo(
    () => collectCategories(budgetExpenses, DEFAULT_CATEGORY_OPTIONS),
    [budgetExpenses],
  );

  const assumptions = useMemo(
    () =>
      workspaceSettings?.budgetAssumptions ?? {
        startingBalance: 0,
        monthlyIncomeEstimate: 0,
      },
    [workspaceSettings],
  );
  const monthBudgets = useMemo(
    () => workspaceSettings?.monthCategoryBudgets ?? {},
    [workspaceSettings],
  );

  const totalBudgeted = useMemo(
    () => Object.values(monthBudgets).reduce((s, n) => s + n, 0),
    [monthBudgets],
  );

  const monthOutgoingExpenses = useMemo(
    () => filterOutgoingExpensesInMonth(budgetExpenses, viewYear, viewMonthIndex),
    [budgetExpenses, viewYear, viewMonthIndex],
  );

  const totalSpentMonth = useMemo(() => sumExpenseAmounts(monthOutgoingExpenses), [monthOutgoingExpenses]);
  const remainingBudget = totalBudgeted - totalSpentMonth;
  const usagePct = totalBudgeted > 0 ? (totalSpentMonth / totalBudgeted) * 100 : 0;

  const ytdExp = useMemo(() => ytdExpensesThrough(budgetExpenses, now), [budgetExpenses, now]);
  const ytdIncomingActual = useMemo(() => ytdIncomingThrough(budgetExpenses, now), [budgetExpenses, now]);
  const ytdIncEstimate = useMemo(
    () => ytdIncomeFromMonthlyEstimate(assumptions.monthlyIncomeEstimate, now),
    [assumptions.monthlyIncomeEstimate, now],
  );
  const ytdIncCombined = ytdIncomingActual + ytdIncEstimate;

  const balanceNow = useMemo(
    () =>
      currentEstimatedBalance({
        startingBalance: assumptions.startingBalance,
        monthlyIncomeEstimate: assumptions.monthlyIncomeEstimate,
        ytdIncomingActual,
        ytdExpenses: ytdExp,
        now,
      }),
    [assumptions.startingBalance, assumptions.monthlyIncomeEstimate, ytdIncomingActual, ytdExp, now],
  );

  const projectedEnd = useMemo(
    () =>
      projectedYearEndBalance({
        startingBalance: assumptions.startingBalance,
        monthlyIncomeEstimate: assumptions.monthlyIncomeEstimate,
        ytdIncomingActual,
        ytdExpenses: ytdExp,
        now,
      }),
    [assumptions.startingBalance, assumptions.monthlyIncomeEstimate, ytdIncomingActual, ytdExp, now],
  );

  const balanceDeltaYtd = ytdIncCombined - ytdExp;

  const monthlyActual = useMemo(
    () => monthlyActualTotals(budgetExpenses, viewYear),
    [budgetExpenses, viewYear],
  );

  const chartRowsMonthly = useMemo(
    () => buildForecastChartRows(viewYear, monthlyActual, totalBudgeted || 0, now),
    [viewYear, monthlyActual, totalBudgeted, now],
  );

  const yearTotals = useMemo(() => {
    const map = totalSpendByYear(budgetExpenses);
    const years = yearsPresentInExpenses(budgetExpenses);
    if (years.length === 0) {
      return [{ year: now.getFullYear(), spent: 0, budget: totalBudgeted * 12 }];
    }
    return years.map((year) => ({
      year,
      spent: Number((map.get(year) ?? 0).toFixed(2)),
      budget: totalBudgeted * 12,
    }));
  }, [budgetExpenses, now, totalBudgeted]);

  const prevMonthExpenses = useMemo(() => {
    const py = viewMonthIndex === 0 ? viewYear - 1 : viewYear;
    const pm = viewMonthIndex === 0 ? 11 : viewMonthIndex - 1;
    return filterOutgoingExpensesInMonth(budgetExpenses, py, pm);
  }, [budgetExpenses, viewYear, viewMonthIndex]);

  const prevByCat = useMemo(() => sumByCategory(prevMonthExpenses), [prevMonthExpenses]);
  const currByCat = useMemo(() => sumByCategory(monthOutgoingExpenses), [monthOutgoingExpenses]);

  const categoryRows = useMemo(() => {
    const names = new Set([...categories, ...Object.keys(monthBudgets)]);
    return Array.from(names).map((name, i) => {
      const cap = monthBudgets[name] ?? 0;
      const spent = currByCat.get(name) ?? 0;
      const prevSpent = prevByCat.get(name) ?? 0;
      const pct = cap > 0 ? (spent / cap) * 100 : spent > 0 ? 100 : 0;
      const over = cap > 0 && spent > cap;
      const { trend, label } = categorySpendTrend(spent, prevSpent);
      const remaining = cap - spent;
      return {
        name,
        cap,
        spent,
        pct,
        over,
        trend,
        trendLabel: label,
        remaining,
        dot: CATEGORY_DOT_COLORS[i % CATEGORY_DOT_COLORS.length],
      };
    });
  }, [categories, monthBudgets, currByCat, prevByCat]);

  const sortedRecentTx = useMemo(() => {
    const monthAll = filterExpensesInMonth(expenses, viewYear, viewMonthIndex);
    const list = [...monthAll].sort((a, b) => {
      const ta = expenseDateParts(a.transactionDate).time;
      const tb = expenseDateParts(b.transactionDate).time;
      if (tb !== ta) {
        return tb - ta;
      }
      return Number(b.id) - Number(a.id);
    });
    const chronological = [...monthAll].sort((a, b) => {
      const ta = expenseDateParts(a.transactionDate).time;
      const tb = expenseDateParts(b.transactionDate).time;
      if (ta !== tb) {
        return ta - tb;
      }
      return Number(a.id) - Number(b.id);
    });
    const remainingAfter = new Map<string, number>();
    let running = totalBudgeted;
    for (const e of chronological) {
      if (e.flow !== 'Incoming') {
        running -= e.amount;
      }
      remainingAfter.set(e.id, running);
    }
    return list.map((e) => ({
      expense: e,
      remaining: remainingAfter.get(e.id) ?? 0,
    }));
  }, [expenses, viewYear, viewMonthIndex, totalBudgeted]);

  const monthlyBreakdownDetail = useMemo(() => {
    if (!userId) {
      return { rows: [] as MonthlyBreakdownRow[], totals: null as MonthlyBreakdownTotals | null };
    }
    const incomeEstimate = Number(assumptions.monthlyIncomeEstimate) || 0;
    const y = viewYear;
    const rows: MonthlyBreakdownRow[] = [];
    let sumIncome = 0;
    let sumExpenses = 0;
    let sumBudget = 0;
    let sumSavings = 0;
    let actualMonths = 0;

    for (let mi = 0; mi < 12; mi++) {
      const key = toYearMonthKey(y, mi);
      const budMap = key === monthKey ? monthBudgets : {};
      const budgeted = Object.values(budMap).reduce((s, n) => s + n, 0);
      const spent = sumExpenseAmounts(filterOutgoingExpensesInMonth(budgetExpenses, y, mi));
      const incomeActual = sumExpenseAmounts(filterIncomingExpensesInMonth(budgetExpenses, y, mi));
      const isProjected = y > now.getFullYear() || (y === now.getFullYear() && mi > now.getMonth());
      const incomeShown = isProjected ? incomeEstimate : incomeActual > 0 ? incomeActual : incomeEstimate;

      if (!isProjected) {
        sumIncome += incomeShown;
        sumExpenses += spent;
        sumBudget += budgeted;
        sumSavings += incomeShown - spent;
        actualMonths += 1;
      }

      const variance = !isProjected && budgeted > 0 ? budgeted - spent : null;
      const savings = !isProjected ? incomeShown - spent : null;
      let status: MonthlyBreakdownRow['status'] = 'na';
      if (!isProjected && budgeted > 0) {
        status = spent <= budgeted ? 'under' : 'over';
      }

      rows.push({
        key,
        label: new Date(y, mi, 1).toLocaleString('en-US', { month: 'short' }),
        income: incomeShown,
        expenses: isProjected ? null : spent,
        budget: budgeted,
        variance,
        savings,
        status,
        isProjected,
      });
    }

    const totals: MonthlyBreakdownTotals | null =
      actualMonths > 0
        ? {
            income: sumIncome,
            expenses: sumExpenses,
            budget: sumBudget,
            savings: sumSavings,
          }
        : null;

    return { rows, totals };
  }, [userId, viewYear, budgetExpenses, monthBudgets, monthKey, assumptions.monthlyIncomeEstimate, now]);

  const categoryTrendsTable = useMemo(() => {
    const y = viewYear;
    const lastMi =
      y < now.getFullYear() ? 11 : y > now.getFullYear() ? -1 : now.getMonth();
    if (lastMi < 0) {
      return {
        monthIndices: [] as number[],
        labels: [] as string[],
        rows: [] as CategoryTrendRow[],
        columnTotals: [] as number[],
      };
    }
    const monthIndices = Array.from({ length: lastMi + 1 }, (_, i) => i);
    const labels = monthIndices.map((mi) =>
      new Date(y, mi, 1).toLocaleString('en-US', { month: 'short' }).toUpperCase(),
    );
    const catList = [...categories].sort((a, b) => a.localeCompare(b));
    const rows: CategoryTrendRow[] = catList.map((cat) => {
      const cap = monthBudgets[cat] ?? 0;
      const monthAmounts = monthIndices.map((mi) => {
        const inMonth = filterOutgoingExpensesInMonth(budgetExpenses, y, mi).filter(
          (e) => toBudgetTopLevelCategory(e.category) === cat,
        );
        return sumExpenseAmounts(inMonth);
      });
      const ytd = monthAmounts.reduce((a, b) => a + b, 0);
      const n = monthIndices.length;
      const avg = n > 0 ? ytd / n : 0;
      const prev = monthAmounts.length >= 2 ? monthAmounts[monthAmounts.length - 2] : 0;
      const last = monthAmounts.length >= 1 ? monthAmounts[monthAmounts.length - 1] : 0;
      const { trend, label } = categorySpendTrend(last, prev);
      return { cat, cap, monthAmounts, ytd, avg, trend, trendLabel: label };
    });
    const columnTotals = monthIndices.map((_, colIdx) =>
      Number(rows.reduce((s, r) => s + r.monthAmounts[colIdx], 0).toFixed(2)),
    );
    return { monthIndices, labels, rows, columnTotals };
  }, [viewYear, now, budgetExpenses, categories, monthBudgets]);

  const openBudgetModal = useCallback(() => {
    setDraftAssumptions(assumptions);
    const existing = monthBudgets;
    const suggested = suggestMonthBudgetsFromPreviousMonth(budgetExpenses, viewYear, viewMonthIndex, categories);
    const merged: Record<string, string> = {};
    for (const c of categories) {
      const v = existing[c] ?? suggested[c] ?? 0;
      merged[c] = v > 0 ? String(v) : '';
    }
    setDraftCategoryBudgets(merged);
    setBudgetModalOpen(true);
  }, [assumptions, monthBudgets, budgetExpenses, viewYear, viewMonthIndex, categories]);

  useEffect(() => {
    if (!budgetModalOpen) {
      return;
    }
    setDraftAssumptions(assumptions);
  }, [assumptions, budgetModalOpen]);

  const onSaveBudgets = async (event: FormEvent) => {
    event.preventDefault();
    if (!userId) {
      return;
    }
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(draftCategoryBudgets)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) {
        next[k] = n;
      }
    }
    await saveSettings({
      budgetAssumptions: {
        startingBalance: Number(draftAssumptions.startingBalance) || 0,
        monthlyIncomeEstimate: Number(draftAssumptions.monthlyIncomeEstimate) || 0,
      },
      monthCategoryBudgets: { yearMonth: monthKey, budgets: next },
    });
    setBudgetModalOpen(false);
  };

  const monthPickerValue = `${viewYear}-${pad2(viewMonthIndex + 1)}`;

  const onMonthPickerChange = (value: string) => {
    const [y, m] = value.split('-').map(Number);
    if (!y || !m) {
      return;
    }
    setViewYear(y);
    setViewMonthIndex(m - 1);
  };

  return {
    loading: loading || workspaceLoading,
    error,
    now,
    balanceNow,
    balanceDeltaYtd,
    projectedEnd,
    ytdIncCombined,
    ytdIncomingActual,
    ytdIncEstimate,
    ytdExp,
    viewYear,
    viewMonthIndex,
    monthPickerValue,
    onMonthPickerChange,
    totalBudgeted,
    totalSpentMonth,
    remainingBudget,
    usagePct,
    detailTab,
    setDetailTab,
    sortedRecentTx,
    monthlyBreakdownDetail,
    categoryTrendsTable,
    chartTab,
    setChartTab,
    chartRowsMonthly,
    yearTotals,
    categoryRows,
    openBudgetModal,
    budgetModalOpen,
    setBudgetModalOpen,
    draftAssumptions,
    setDraftAssumptions,
    draftCategoryBudgets,
    setDraftCategoryBudgets,
    onSaveBudgets,
    categories,
    monthKey,
    mixedCurrencyWarning,
    budgetCurrency,
    formatBudgetAmount,
  };
};
