import { useApolloClient, useQuery } from '@apollo/client/react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CURRENCY_CODE, formatCurrency } from '../../format/currency';
import { FX_RATE } from './graphql';
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
  sumByCategory,
  expenseCurrencyCode,
  sumExpenseAmounts,
  sumExpenseAmountsWithFx,
  toYearMonthKey,
  ytdOutgoingExpensesThrough,
  totalSpendByYear,
  yearsPresentInExpenses,
  ytdExpensesThrough,
  ytdIncomingThrough,
  ytdIncomeFromMonthlyEstimate,
  pad2,
} from './selectors';
import { useUserWorkspaceSettings } from '../userSettings';
import type { BudgetAssumptions } from './storage';
import { CATEGORY_DOT_COLORS, DEFAULT_CATEGORY_OPTIONS } from './budgetPageStyles';
import type { CategoryTrendRow, MonthlyBreakdownRow, MonthlyBreakdownTotals } from './budgetPageTypes';
import { GET_EXPENSES, toBudgetTopLevelCategory, type GetExpensesResponse } from '../expenses';
import {
  collectAllExpenseCategoriesForMapping,
  expenseCategoryMappingKey,
  resolveBudgetCategory,
  sanitizeBudgetCategoryMappings,
  type BudgetCategoryMappings,
} from './budgetCategoryMappings';
import { expenseCategoryExtrasFromWorkspace } from '../expenses/categories';
import type { BudgetGoal } from './goalsStorage';
import { loadBudgetGoals, saveBudgetGoals } from './goalsStorage';
import {
  build503020CategoryBudgets,
  buildBudgetSetupDraftLimits,
  isBudgetSetupConfigured,
} from './budget503020';
import { parseLocaleAmountInput } from '../../format/parseAmountInput';
import { buildBudgetInsights } from './budgetInsights';
import type { BudgetInsight } from './budgetInsights';

export type BudgetMainTab = 'overview' | 'transactions' | 'categories' | 'budget_setup' | 'goals' | 'reports';

const normalizeBudgetCustomCategories = (names: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const c = raw.trim();
    if (!c || c.length > 64) {
      continue;
    }
    const low = c.toLowerCase();
    if (seen.has(low)) {
      continue;
    }
    seen.add(low);
    out.push(c);
  }
  return out.sort((a, b) => a.localeCompare(b));
};

export type MonthReportBarRow = {
  label: string;
  income: number;
  spent: number;
  budget: number;
};

export const useBudgetPageState = () => {
  const { user } = useAuth();
  const client = useApolloClient();
  const userId = user?.id ?? '';
  const now = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonthIndex, setViewMonthIndex] = useState(now.getMonth());
  const [detailTab, setDetailTab] = useState<'recent' | 'months' | 'trends'>('recent');
  const [chartTab, setChartTab] = useState<'monthly' | 'yearly'>('monthly');
  const [mainTab, setMainTab] = useState<BudgetMainTab>('overview');
  const [txSearch, setTxSearch] = useState('');
  const [txCategoryFilter, setTxCategoryFilter] = useState<string>('all');
  const [goals, setGoalsState] = useState<BudgetGoal[]>([]);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);

  const monthKey = toYearMonthKey(viewYear, viewMonthIndex);
  const {
    settings: workspaceSettings,
    loading: workspaceLoading,
    saveSettings,
    refetch: refetchWorkspaceSettings,
  } = useUserWorkspaceSettings(userId, monthKey);

  const [draftAssumptions, setDraftAssumptions] = useState<BudgetAssumptions>({
    startingBalance: 0,
    monthlyIncomeEstimate: 0,
  });
  const [draftCategoryBudgets, setDraftCategoryBudgets] = useState<Record<string, string>>({});
  const lastBudgetSetupInitKey = useRef<string | null>(null);
  const lastCategoriesTabInitKey = useRef<string | null>(null);
  const [savingCategoryMappings, setSavingCategoryMappings] = useState(false);
  const [categoryMappingsFeedback, setCategoryMappingsFeedback] = useState<string | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [resettingBudget, setResettingBudget] = useState(false);
  const [budgetSaveFeedback, setBudgetSaveFeedback] = useState<string | null>(null);
  const clearBudgetSaveFeedback = useCallback(() => {
    setBudgetSaveFeedback(null);
  }, []);

  useEffect(() => {
    setGoalsState(loadBudgetGoals(userId));
  }, [userId]);

  const persistGoals = useCallback(
    (next: BudgetGoal[]) => {
      setGoalsState(next);
      saveBudgetGoals(userId, next);
    },
    [userId],
  );

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

  const [fxRatesToAppCurrency, setFxRatesToAppCurrency] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!mixedCurrencyWarning) {
      setFxRatesToAppCurrency({});
      return;
    }
    const foreignCodes = [
      ...new Set(viewYearExpenses.map(expenseCurrencyCode)),
    ].filter((code) => code !== APP_CURRENCY_CODE);
    if (foreignCodes.length === 0) {
      setFxRatesToAppCurrency({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const pairs = await Promise.all(
        foreignCodes.map(async (code) => {
          const { data } = await client.query<{ fxRate: number }>({
            query: FX_RATE,
            variables: { from: code, to: APP_CURRENCY_CODE },
            fetchPolicy: 'cache-first',
          });
          return [code, data?.fxRate ?? 0] as const;
        }),
      );
      if (!cancelled) {
        setFxRatesToAppCurrency(Object.fromEntries(pairs.filter(([, rate]) => rate > 0)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, mixedCurrencyWarning, viewYearExpenses]);

  const indicativeYtdExpenses = useMemo(() => {
    if (!mixedCurrencyWarning) {
      return null;
    }
    const foreignCodes = [...new Set(viewYearExpenses.map(expenseCurrencyCode))].filter(
      (code) => code !== APP_CURRENCY_CODE,
    );
    if (foreignCodes.some((code) => fxRatesToAppCurrency[code] === undefined)) {
      return null;
    }
    return sumExpenseAmountsWithFx(
      ytdOutgoingExpensesThrough(expenses, now),
      fxRatesToAppCurrency,
      APP_CURRENCY_CODE,
    );
  }, [mixedCurrencyWarning, viewYearExpenses, fxRatesToAppCurrency, expenses, now]);

  const formatIndicativeAppAmount = useCallback(
    (value: number) => formatCurrency(value, APP_CURRENCY_CODE),
    [],
  );

  const assumptions = useMemo(
    () =>
      workspaceSettings?.budgetAssumptions ?? {
        startingBalance: 0,
        monthlyIncomeEstimate: 0,
      },
    [workspaceSettings],
  );
  const categoryBudgetLimits = useMemo(
    () =>
      workspaceSettings?.categoryBudgetDefaults ??
      workspaceSettings?.monthCategoryBudgets ??
      {},
    [workspaceSettings],
  );

  const savedBudgetCategoryMappings = useMemo(
    () => workspaceSettings?.budgetCategoryMappings ?? {},
    [workspaceSettings?.budgetCategoryMappings],
  );

  const [draftBudgetCategoryMappings, setDraftBudgetCategoryMappings] = useState<BudgetCategoryMappings>({});
  const [draftBudgetCustomCategories, setDraftBudgetCustomCategories] = useState<string[]>([]);

  useEffect(() => {
    setDraftBudgetCategoryMappings((prev) => {
      const prevSan = sanitizeBudgetCategoryMappings(prev);
      const savedSan = sanitizeBudgetCategoryMappings(savedBudgetCategoryMappings);
      if (JSON.stringify(prevSan) === JSON.stringify(savedSan)) {
        return prev;
      }
      if (Object.keys(prevSan).length === 0) {
        return { ...savedBudgetCategoryMappings };
      }
      return prev;
    });
  }, [savedBudgetCategoryMappings]);

  useEffect(() => {
    const saved = workspaceSettings?.budgetCustomCategories ?? [];
    setDraftBudgetCustomCategories((prev) => {
      const prevNorm = normalizeBudgetCustomCategories(prev);
      const savedNorm = normalizeBudgetCustomCategories(saved);
      if (JSON.stringify(prevNorm) === JSON.stringify(savedNorm)) {
        return prev;
      }
      if (prevNorm.length === 0) {
        return [...saved];
      }
      return prev;
    });
  }, [workspaceSettings?.budgetCustomCategories]);

  const resolveExpenseToBudgetCategory = useCallback(
    (expenseCategory: string) => resolveBudgetCategory(expenseCategory, savedBudgetCategoryMappings),
    [savedBudgetCategoryMappings],
  );

  const baseCategoryList = useMemo(() => {
    const set = new Set([
      ...collectCategories(budgetExpenses, DEFAULT_CATEGORY_OPTIONS, savedBudgetCategoryMappings),
      ...Object.keys(categoryBudgetLimits),
      ...(workspaceSettings?.budgetCustomCategories ?? []),
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [budgetExpenses, categoryBudgetLimits, workspaceSettings?.budgetCustomCategories, savedBudgetCategoryMappings]);

  const expenseCategoriesForMapping = useMemo(
    () =>
      collectAllExpenseCategoriesForMapping(
        budgetExpenses,
        expenseCategoryExtrasFromWorkspace(workspaceSettings),
      ),
    [budgetExpenses, workspaceSettings],
  );

  const budgetLinesForMapping = useMemo(() => {
    const set = new Set([
      ...DEFAULT_CATEGORY_OPTIONS,
      ...Object.keys(categoryBudgetLimits),
      ...(workspaceSettings?.budgetCustomCategories ?? []),
      ...draftBudgetCustomCategories,
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categoryBudgetLimits, workspaceSettings?.budgetCustomCategories, draftBudgetCustomCategories]);

  const categoryMappingsDirty = useMemo(() => {
    const draft = sanitizeBudgetCategoryMappings(draftBudgetCategoryMappings);
    const saved = sanitizeBudgetCategoryMappings(savedBudgetCategoryMappings);
    const mappingsDirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const customDirty =
      JSON.stringify(normalizeBudgetCustomCategories(draftBudgetCustomCategories)) !==
      JSON.stringify(normalizeBudgetCustomCategories(workspaceSettings?.budgetCustomCategories ?? []));
    return mappingsDirty || customDirty;
  }, [
    draftBudgetCategoryMappings,
    savedBudgetCategoryMappings,
    draftBudgetCustomCategories,
    workspaceSettings?.budgetCustomCategories,
  ]);

  const categories = useMemo(() => {
    return [...baseCategoryList].sort((a, b) => a.localeCompare(b));
  }, [baseCategoryList]);

  const totalBudgeted = useMemo(
    () => Object.values(categoryBudgetLimits).reduce((s, n) => s + n, 0),
    [categoryBudgetLimits],
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

  const prevByCat = useMemo(
    () => sumByCategory(prevMonthExpenses, savedBudgetCategoryMappings),
    [prevMonthExpenses, savedBudgetCategoryMappings],
  );
  const currByCat = useMemo(
    () => sumByCategory(monthOutgoingExpenses, savedBudgetCategoryMappings),
    [monthOutgoingExpenses, savedBudgetCategoryMappings],
  );

  const categoryRows = useMemo(() => {
    const names = new Set([...categories, ...Object.keys(categoryBudgetLimits)]);
    return Array.from(names).map((name, i) => {
      const cap = categoryBudgetLimits[name] ?? 0;
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
  }, [categories, categoryBudgetLimits, currByCat, prevByCat]);

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
      const budgeted = Object.values(categoryBudgetLimits).reduce((s, n) => s + n, 0);
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
  }, [userId, viewYear, budgetExpenses, categoryBudgetLimits, assumptions.monthlyIncomeEstimate, now]);

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
      const cap = categoryBudgetLimits[cat] ?? 0;
      const monthAmounts = monthIndices.map((mi) => {
        const inMonth = filterOutgoingExpensesInMonth(budgetExpenses, y, mi).filter(
          (e) => resolveBudgetCategory(e.category, savedBudgetCategoryMappings) === cat,
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
  }, [viewYear, now, budgetExpenses, categories, categoryBudgetLimits, savedBudgetCategoryMappings]);

  const openBudgetModal = useCallback(() => {
    setDraftAssumptions(assumptions);
    setDraftBudgetCustomCategories(workspaceSettings?.budgetCustomCategories ?? []);
    const incomeEstimate = Number(assumptions.monthlyIncomeEstimate) || 0;
    setDraftCategoryBudgets(buildBudgetSetupDraftLimits(categories, incomeEstimate, categoryBudgetLimits));
    setBudgetModalOpen(true);
  }, [assumptions, categoryBudgetLimits, categories, workspaceSettings?.budgetCustomCategories]);

  useEffect(() => {
    if (!budgetModalOpen) {
      return;
    }
    setDraftAssumptions(assumptions);
  }, [assumptions, budgetModalOpen]);

  const onResetBudgetSetup = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      return false;
    }
    setResettingBudget(true);
    setBudgetSaveFeedback(null);
    try {
      const saved = await saveSettings({
        budgetAssumptions: { startingBalance: 0, monthlyIncomeEstimate: 0 },
        categoryBudgetDefaults: {},
        monthCategoryBudgets: { yearMonth: monthKey, budgets: {} },
      });
      if (!saved) {
        setBudgetSaveFeedback('Could not clear budget setup.');
        return false;
      }
      await refetchWorkspaceSettings();
      setDraftAssumptions({ startingBalance: 0, monthlyIncomeEstimate: 0 });
      setDraftCategoryBudgets({});
      setBudgetSaveFeedback('Budget setup cleared. You can set up a new template with Edit.');
      return true;
    } catch (err) {
      setBudgetSaveFeedback(err instanceof Error ? err.message : 'Could not clear budget setup.');
      return false;
    } finally {
      setResettingBudget(false);
    }
  }, [userId, monthKey, saveSettings, refetchWorkspaceSettings]);

  const onSaveBudgets = async (event: FormEvent): Promise<boolean> => {
    event.preventDefault();
    if (!userId) {
      return false;
    }
    setSavingBudget(true);
    setBudgetSaveFeedback(null);
    const incomeEstimate = Number(draftAssumptions.monthlyIncomeEstimate) || 0;
    const from503020 =
      incomeEstimate > 0 ? build503020CategoryBudgets(categories, incomeEstimate) : {};
    const next: Record<string, number> = {};
    const catNames = [...new Set([...categories, ...Object.keys(draftCategoryBudgets)])];
    for (const c of catNames) {
      const raw = draftCategoryBudgets[c]?.trim();
      const n = raw ? parseLocaleAmountInput(raw) : from503020[c] ?? 0;
      if (Number.isFinite(n) && n > 0) {
        next[c] = n;
      }
    }
    try {
      const saved = await saveSettings({
        budgetAssumptions: {
          startingBalance: Number(draftAssumptions.startingBalance) || 0,
          monthlyIncomeEstimate: incomeEstimate,
        },
        categoryBudgetDefaults: next,
        budgetCustomCategories: workspaceSettings?.budgetCustomCategories ?? [],
      });
      if (!saved) {
        setBudgetSaveFeedback('Could not save budget.');
        return false;
      }
      await refetchWorkspaceSettings();
      const configured = isBudgetSetupConfigured(
        {
          startingBalance: Number(draftAssumptions.startingBalance) || 0,
          monthlyIncomeEstimate: incomeEstimate,
        },
        next,
      );
      setBudgetSaveFeedback(
        configured
          ? 'Budget saved. Your monthly template applies to every month.'
          : 'Budget setup cleared. Add your monthly income and limits to create a new template.',
      );
      setBudgetModalOpen(false);
      return true;
    } catch (err) {
      setBudgetSaveFeedback(err instanceof Error ? err.message : 'Could not save budget.');
      return false;
    } finally {
      setSavingBudget(false);
    }
  };

  const monthIncomingActual = useMemo(
    () => sumExpenseAmounts(filterIncomingExpensesInMonth(budgetExpenses, viewYear, viewMonthIndex)),
    [budgetExpenses, viewYear, viewMonthIndex],
  );

  const monthIncomeDisplay = useMemo(() => {
    if (monthIncomingActual > 0) {
      return monthIncomingActual;
    }
    return Number(assumptions.monthlyIncomeEstimate) || 0;
  }, [monthIncomingActual, assumptions.monthlyIncomeEstimate]);

  const monthSaved = useMemo(
    () => Number((monthIncomeDisplay - totalSpentMonth).toFixed(2)),
    [monthIncomeDisplay, totalSpentMonth],
  );

  const savingsRatePct = useMemo(
    () => (monthIncomeDisplay > 0 ? (monthSaved / monthIncomeDisplay) * 100 : 0),
    [monthIncomeDisplay, monthSaved],
  );

  const budgetInsights = useMemo(
    (): BudgetInsight[] =>
      buildBudgetInsights(categoryRows, {
        formatAmount: formatBudgetAmount,
        monthIncome: monthIncomeDisplay,
        monthSaved,
        savingsRatePct,
        totalBudgeted,
        totalSpentMonth,
        viewYear,
        viewMonthIndex,
        now,
      }),
    [
      categoryRows,
      formatBudgetAmount,
      monthIncomeDisplay,
      monthSaved,
      savingsRatePct,
      totalBudgeted,
      totalSpentMonth,
      viewYear,
      viewMonthIndex,
      now,
    ],
  );

  const shiftViewMonth = useCallback(
    (delta: number) => {
      let y = viewYear;
      let m = viewMonthIndex + delta;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      while (m > 11) {
        m -= 12;
        y += 1;
      }
      setViewYear(y);
      setViewMonthIndex(m);
    },
    [viewYear, viewMonthIndex],
  );

  const last6MonthsReport = useMemo((): MonthReportBarRow[] => {
    const rows: MonthReportBarRow[] = [];
    for (let i = 5; i >= 0; i--) {
      let y = viewYear;
      let m = viewMonthIndex - i;
      while (m < 0) {
        m += 12;
        y -= 1;
      }
      const incoming = sumExpenseAmounts(filterIncomingExpensesInMonth(budgetExpenses, y, m));
      const spent = sumExpenseAmounts(filterOutgoingExpensesInMonth(budgetExpenses, y, m));
      const income = incoming > 0 ? incoming : Number(assumptions.monthlyIncomeEstimate) || 0;
      rows.push({
        label: new Date(y, m, 1).toLocaleString('en-US', { month: 'short' }),
        income,
        spent,
        budget: totalBudgeted,
      });
    }
    return rows;
  }, [viewYear, viewMonthIndex, budgetExpenses, assumptions.monthlyIncomeEstimate, totalBudgeted]);

  const reportsAvgMonthlySpend = useMemo(
    () =>
      last6MonthsReport.length > 0
        ? last6MonthsReport.reduce((s, r) => s + r.spent, 0) / last6MonthsReport.length
        : 0,
    [last6MonthsReport],
  );

  const reportsAvgSavingsRate = useMemo(() => {
    let sum = 0;
    let n = 0;
    for (const r of last6MonthsReport) {
      if (r.income > 0) {
        sum += ((r.income - r.spent) / r.income) * 100;
        n += 1;
      }
    }
    return n > 0 ? sum / n : 0;
  }, [last6MonthsReport]);

  const reportsMostOverspent = useMemo(() => {
    let worst: { name: string; pct: number } | null = null;
    for (const row of categoryRows) {
      if (row.cap > 0 && row.spent > row.cap) {
        const pct = ((row.spent - row.cap) / row.cap) * 100;
        if (!worst || pct > worst.pct) {
          worst = { name: row.name, pct };
        }
      }
    }
    return worst;
  }, [categoryRows]);

  const reportsTopCategories = useMemo(() => {
    return [...categoryRows].sort((a, b) => b.spent - a.spent).slice(0, 5);
  }, [categoryRows]);

  const transactionsForMonth = useMemo(
    () =>
      [...filterExpensesInMonth(budgetExpenses, viewYear, viewMonthIndex)].sort(
        (a, b) => expenseDateParts(b.transactionDate).time - expenseDateParts(a.transactionDate).time,
      ),
    [budgetExpenses, viewYear, viewMonthIndex],
  );

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactionsForMonth.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q)) {
        return false;
      }
      if (txCategoryFilter !== 'all') {
        if (resolveBudgetCategory(e.category, savedBudgetCategoryMappings) !== txCategoryFilter) {
          return false;
        }
      }
      return true;
    });
  }, [transactionsForMonth, txSearch, txCategoryFilter, savedBudgetCategoryMappings]);

  const budgetSetupInitKey = `${JSON.stringify(assumptions)}|${JSON.stringify(categoryBudgetLimits)}|${JSON.stringify(workspaceSettings?.budgetCustomCategories ?? [])}`;

  const annualBudgetTotal = useMemo(
    () => Number((totalBudgeted * 12).toFixed(2)),
    [totalBudgeted],
  );

  const categoriesTabInitKey = JSON.stringify({
    mappings: savedBudgetCategoryMappings,
    custom: workspaceSettings?.budgetCustomCategories ?? [],
  });

  useEffect(() => {
    if (mainTab !== 'categories') {
      lastCategoriesTabInitKey.current = null;
      return;
    }
    if (lastCategoriesTabInitKey.current === categoriesTabInitKey) {
      return;
    }
    lastCategoriesTabInitKey.current = categoriesTabInitKey;
    setDraftBudgetCategoryMappings({ ...savedBudgetCategoryMappings });
    setDraftBudgetCustomCategories([...(workspaceSettings?.budgetCustomCategories ?? [])]);
    setCategoryMappingsFeedback(null);
  }, [mainTab, categoriesTabInitKey, savedBudgetCategoryMappings, workspaceSettings?.budgetCustomCategories]);

  const onSaveCategoryMappings = useCallback(async () => {
    if (!userId) {
      return;
    }
    setSavingCategoryMappings(true);
    setCategoryMappingsFeedback(null);
    try {
      const sanitized = sanitizeBudgetCategoryMappings(draftBudgetCategoryMappings);
      const customNames = normalizeBudgetCustomCategories(draftBudgetCustomCategories);
      const updated = await saveSettings({
        budgetCategoryMappings: sanitized,
        budgetCustomCategories: customNames,
      });
      if (updated) {
        setDraftBudgetCategoryMappings({ ...updated.budgetCategoryMappings });
        setDraftBudgetCustomCategories([...updated.budgetCustomCategories]);
      }
      setCategoryMappingsFeedback('Categories and mappings saved.');
    } catch (err) {
      setCategoryMappingsFeedback(err instanceof Error ? err.message : 'Could not save mappings.');
    } finally {
      setSavingCategoryMappings(false);
    }
  }, [userId, draftBudgetCategoryMappings, draftBudgetCustomCategories, saveSettings]);

  const setExpenseCategoryMapping = useCallback((expenseLabel: string, budgetCategory: string) => {
    const key = expenseCategoryMappingKey(expenseLabel);
    const builtIn = toBudgetTopLevelCategory(expenseLabel);
    setDraftBudgetCategoryMappings((prev) => {
      if (budgetCategory === builtIn) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: budgetCategory };
    });
  }, []);

  const getExpenseCategoryMappingValue = useCallback(
    (expenseLabel: string): string => {
      const key = expenseCategoryMappingKey(expenseLabel);
      return (
        draftBudgetCategoryMappings[key] ??
        savedBudgetCategoryMappings[key] ??
        toBudgetTopLevelCategory(expenseLabel)
      );
    },
    [draftBudgetCategoryMappings, savedBudgetCategoryMappings],
  );

  useEffect(() => {
    if (mainTab !== 'budget_setup') {
      lastBudgetSetupInitKey.current = null;
      return;
    }
    if (lastBudgetSetupInitKey.current === budgetSetupInitKey) {
      return;
    }
    lastBudgetSetupInitKey.current = budgetSetupInitKey;

    setDraftAssumptions(assumptions);
    setBudgetSaveFeedback(null);
    const savedCustom = workspaceSettings?.budgetCustomCategories ?? [];
    const catList = [
      ...new Set([
        ...collectCategories(budgetExpenses, DEFAULT_CATEGORY_OPTIONS),
        ...Object.keys(categoryBudgetLimits),
        ...savedCustom,
      ]),
    ].sort((a, b) => a.localeCompare(b));
    const incomeEstimate = Number(assumptions.monthlyIncomeEstimate) || 0;
    setDraftCategoryBudgets(
      buildBudgetSetupDraftLimits(catList, incomeEstimate, categoryBudgetLimits),
    );
  }, [
    mainTab,
    budgetSetupInitKey,
    assumptions,
    categoryBudgetLimits,
    budgetExpenses,
    viewYear,
    viewMonthIndex,
    workspaceSettings?.budgetCustomCategories,
  ]);

  const addBudgetCustomCategory = useCallback(
    (raw: string) => {
      const name = raw.trim();
      if (!name || name.length > 64) {
        return;
      }
      const lower = name.toLowerCase();
      if (baseCategoryList.some((c) => c.toLowerCase() === lower)) {
        return;
      }
      setDraftBudgetCustomCategories((prev) => {
        if (prev.some((c) => c.toLowerCase() === lower)) {
          return prev;
        }
        return [...prev, name];
      });
      setDraftCategoryBudgets((p) => ({ ...p, [name]: p[name] ?? '' }));
    },
    [baseCategoryList],
  );

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
    assumptions,
    categoryBudgetLimits,
    draftAssumptions,
    setDraftAssumptions,
    draftCategoryBudgets,
    setDraftCategoryBudgets,
    onSaveBudgets,
    onResetBudgetSetup,
    savingBudget,
    resettingBudget,
    budgetSaveFeedback,
    clearBudgetSaveFeedback,
    annualBudgetTotal,
    addBudgetCustomCategory,
    draftBudgetCustomCategories,
    expenseCategoriesForMapping,
    budgetLinesForMapping,
    setExpenseCategoryMapping,
    getExpenseCategoryMappingValue,
    resolveExpenseToBudgetCategory,
    onSaveCategoryMappings,
    savingCategoryMappings,
    categoryMappingsDirty,
    categoryMappingsFeedback,
    categories,
    monthKey,
    mixedCurrencyWarning,
    budgetCurrency,
    formatBudgetAmount,
    indicativeYtdExpenses,
    formatIndicativeAppAmount,
    mainTab,
    setMainTab,
    shiftViewMonth,
    monthIncomeDisplay,
    monthIncomingActual,
    monthSaved,
    savingsRatePct,
    budgetInsights,
    txSearch,
    setTxSearch,
    txCategoryFilter,
    setTxCategoryFilter,
    filteredTransactions,
    last6MonthsReport,
    reportsAvgMonthlySpend,
    reportsAvgSavingsRate,
    reportsMostOverspent,
    reportsTopCategories,
    goals,
    persistGoals,
  };
};
