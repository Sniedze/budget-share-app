import type { Expense } from '../expenses/types';
import { toBudgetTopLevelCategory } from '../expenses/categories';

const isIncomingExpense = (e: Expense): boolean => e.flow === 'Incoming';

export const pad2 = (n: number): string => String(n).padStart(2, '0');

export const toYearMonthKey = (year: number, monthIndex0: number): string =>
  `${year}-${pad2(monthIndex0 + 1)}`;

export const expenseDateParts = (
  iso: string,
): { year: number; monthIndex: number; time: number; day: number } => {
  const d = new Date(iso);
  return {
    year: d.getFullYear(),
    monthIndex: d.getMonth(),
    time: d.getTime(),
    day: d.getDate(),
  };
};

export const filterExpensesInMonth = (expenses: Expense[], year: number, monthIndex: number): Expense[] =>
  expenses.filter((e) => {
    const { year: y, monthIndex: mi } = expenseDateParts(e.transactionDate);
    return y === year && mi === monthIndex;
  });

export const filterIncomingExpensesInMonth = (
  expenses: Expense[],
  year: number,
  monthIndex: number,
): Expense[] => filterExpensesInMonth(expenses, year, monthIndex).filter(isIncomingExpense);

export const filterOutgoingExpensesInMonth = (
  expenses: Expense[],
  year: number,
  monthIndex: number,
): Expense[] => filterExpensesInMonth(expenses, year, monthIndex).filter((e) => !isIncomingExpense(e));

export const sumExpenseAmounts = (expenses: Expense[]): number =>
  expenses.reduce((sum, e) => sum + e.amount, 0);

export const ytdExpensesThrough = (expenses: Expense[], now: Date): number => {
  const y = now.getFullYear();
  const end = now.getTime();
  return expenses
    .filter((e) => {
      if (isIncomingExpense(e)) {
        return false;
      }
      const { year, time } = expenseDateParts(e.transactionDate);
      return year === y && time <= end;
    })
    .reduce((sum, e) => sum + e.amount, 0);
};

export const ytdIncomingThrough = (expenses: Expense[], now: Date): number => {
  const y = now.getFullYear();
  const end = now.getTime();
  return expenses
    .filter((e) => {
      if (!isIncomingExpense(e)) {
        return false;
      }
      const { year, time } = expenseDateParts(e.transactionDate);
      return year === y && time <= end;
    })
    .reduce((sum, e) => sum + e.amount, 0);
};

export const sumByCategory = (expenses: Expense[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (isIncomingExpense(e)) {
      continue;
    }
    const c = toBudgetTopLevelCategory(e.category);
    map.set(c, (map.get(c) ?? 0) + e.amount);
  }
  return map;
};

/** Full months counted from January through current month (1–12). */
export const monthsElapsedInYear = (now: Date): number => now.getMonth() + 1;

export const ytdIncomeFromMonthlyEstimate = (monthlyEstimate: number, now: Date): number => {
  if (monthlyEstimate <= 0) {
    return 0;
  }
  return monthlyEstimate * monthsElapsedInYear(now);
};

export const currentEstimatedBalance = (params: {
  startingBalance: number;
  monthlyIncomeEstimate: number;
  ytdIncomingActual: number;
  ytdExpenses: number;
  now: Date;
}): number => {
  const ytdIncEst = ytdIncomeFromMonthlyEstimate(params.monthlyIncomeEstimate, params.now);
  return params.startingBalance + params.ytdIncomingActual + ytdIncEst - params.ytdExpenses;
};

export const projectedYearEndBalance = (params: {
  startingBalance: number;
  monthlyIncomeEstimate: number;
  ytdIncomingActual: number;
  ytdExpenses: number;
  now: Date;
}): number => {
  const { startingBalance, monthlyIncomeEstimate, ytdIncomingActual, ytdExpenses, now } = params;
  const months = monthsElapsedInYear(now);
  const avgSpend = months > 0 ? ytdExpenses / months : ytdExpenses;
  const annualSpendProj = avgSpend * 12;
  const ytdIncEst = ytdIncomeFromMonthlyEstimate(monthlyIncomeEstimate, now);
  const ytdIncTotal = ytdIncomingActual + ytdIncEst;
  const avgMonthlyIncome = months > 0 ? ytdIncTotal / months : ytdIncTotal;
  const annualIncome = avgMonthlyIncome * 12;
  return startingBalance + annualIncome - annualSpendProj;
};

export const ytdRangeLabel = (now: Date): string => {
  const endMonth = now.toLocaleString('en-US', { month: 'long' });
  return `January - ${endMonth}`;
};

export const monthlyActualTotals = (expenses: Expense[], year: number): number[] => {
  const totals = Array.from({ length: 12 }, () => 0);
  for (const e of expenses) {
    if (isIncomingExpense(e)) {
      continue;
    }
    const { year: y, monthIndex: mi } = expenseDateParts(e.transactionDate);
    if (y === year) {
      totals[mi] += e.amount;
    }
  }
  return totals.map((n) => Number(n.toFixed(2)));
};

export type ForecastChartRow = {
  label: string;
  budget: number;
  actual: number | null;
  forecast: number | null;
};

export const buildForecastChartRows = (
  year: number,
  monthlyActual: number[],
  totalMonthlyBudget: number,
  now: Date,
): ForecastChartRow[] => {
  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isCurrentYear = year === now.getFullYear();
  const currentMonthIdx = now.getMonth();

  let avgForForecast = 0;
  if (isCurrentYear) {
    const slice = monthlyActual.slice(0, currentMonthIdx + 1);
    avgForForecast = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
  } else if (year < now.getFullYear()) {
    const total = monthlyActual.reduce((a, b) => a + b, 0);
    avgForForecast = total / 12;
  } else {
    avgForForecast = totalMonthlyBudget;
  }

  return Array.from({ length: 12 }, (_, mi) => {
    let actual: number | null;
    let forecast: number | null;

    if (year < now.getFullYear()) {
      actual = Number(monthlyActual[mi].toFixed(2));
      forecast = null;
    } else if (year > now.getFullYear()) {
      actual = null;
      forecast = Number(avgForForecast.toFixed(2));
    } else if (mi <= currentMonthIdx) {
      actual = Number(monthlyActual[mi].toFixed(2));
      forecast = null;
    } else {
      actual = null;
      forecast = Number(avgForForecast.toFixed(2));
    }

    return {
      label: monthShort[mi],
      budget: totalMonthlyBudget,
      actual,
      forecast,
    };
  });
};

export const collectCategories = (expenses: Expense[], defaults: string[]): string[] => {
  const set = new Set(defaults);
  for (const e of expenses) {
    if (isIncomingExpense(e)) {
      continue;
    }
    const c = toBudgetTopLevelCategory(e.category);
    if (c) {
      set.add(c);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

export const suggestMonthBudgetsFromPreviousMonth = (
  expenses: Expense[],
  year: number,
  monthIndex: number,
  categories: string[],
): Record<string, number> => {
  const prevYear = monthIndex === 0 ? year - 1 : year;
  const prevMonth = monthIndex === 0 ? 11 : monthIndex - 1;
  const prevExpenses = filterOutgoingExpensesInMonth(expenses, prevYear, prevMonth);
  const spent = sumByCategory(prevExpenses);
  const out: Record<string, number> = {};
  for (const c of categories) {
    const s = spent.get(c) ?? 0;
    out[c] = Math.max(50, Math.ceil(s * 1.05));
  }
  return out;
};

export type CategoryTrend = 'up' | 'down' | 'stable';

export const categorySpendTrend = (
  currentSpend: number,
  previousSpend: number,
): { trend: CategoryTrend; label: string } => {
  if (previousSpend <= 0) {
    return { trend: 'stable', label: 'Stable' };
  }
  const delta = (currentSpend - previousSpend) / previousSpend;
  if (delta > 0.05) {
    return { trend: 'up', label: 'Trending up' };
  }
  if (delta < -0.05) {
    return { trend: 'down', label: 'Trending down' };
  }
  return { trend: 'stable', label: 'Stable' };
};

export const yearsPresentInExpenses = (expenses: Expense[]): number[] => {
  const set = new Set<number>();
  for (const e of expenses) {
    set.add(expenseDateParts(e.transactionDate).year);
  }
  return Array.from(set).sort((a, b) => a - b);
};

export const totalSpendByYear = (expenses: Expense[]): Map<number, number> => {
  const map = new Map<number, number>();
  for (const e of expenses) {
    if (isIncomingExpense(e)) {
      continue;
    }
    const y = expenseDateParts(e.transactionDate).year;
    map.set(y, (map.get(y) ?? 0) + e.amount);
  }
  return map;
};
