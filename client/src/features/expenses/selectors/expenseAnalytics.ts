import { formatAppCurrency } from '../../../format/currency';
import type { Expense } from '../types';

export type TrendPoint = {
  month: string;
  amount: number;
};

export type BreakdownPoint = {
  name: string;
  value: number;
};

export type MonthlyOverviewPoint = {
  month: string;
  total: number;
  personal: number;
  shared: number;
  categories: Array<{
    name: string;
    total: number;
  }>;
};

export type DashboardStat = {
  label: string;
  value: string;
  hint: string;
};

export const getTotalAmount = (expenses: Expense[]): number => {
  return expenses.reduce((sum, expense) => sum + expense.amount, 0);
};

export const getDashboardStats = (totalAmount: number): DashboardStat[] => {
  const personalAmount = totalAmount * 0.65;
  const sharedAmount = totalAmount * 0.35;

  return [
    {
      label: 'Total This Month',
      value: formatAppCurrency(totalAmount),
      hint: 'All tracked expenses',
    },
    {
      label: 'Personal Expenses',
      value: formatAppCurrency(personalAmount),
      hint: '65% of total',
    },
    {
      label: 'Shared Expenses',
      value: formatAppCurrency(sharedAmount),
      hint: '35% of total',
    },
    {
      label: 'Active Groups',
      value: '3',
      hint: 'Household, Utilities, Food',
    },
  ];
};

export const getTrendData = (expenses: Expense[]): TrendPoint[] => {
  const byMonth = new Map<string, number>();

  for (const expense of expenses) {
    const date = new Date(expense.transactionDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + expense.amount);
  }

  const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
  const recent = sorted.slice(-6);

  return recent.map(([monthKey, amount]) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    const monthLabel = date.toLocaleString('en-US', { month: 'short' });

    return { month: monthLabel, amount: Number(amount.toFixed(2)) };
  });
};

export const getBreakdownData = (expenses: Expense[]): BreakdownPoint[] => {
  const byTitle = new Map<string, number>();

  for (const expense of expenses) {
    const key = expense.title.trim() || 'Other';
    byTitle.set(key, (byTitle.get(key) ?? 0) + expense.amount);
  }

  const sorted = Array.from(byTitle.entries())
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= 5) {
    return sorted;
  }

  const top = sorted.slice(0, 5);
  const otherValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);

  return [...top, { name: 'Other', value: Number(otherValue.toFixed(2)) }];
};

export const getMonthlyOverview = (expenses: Expense[]): MonthlyOverviewPoint[] => {
  const byMonth = new Map<
    string,
    { total: number; personal: number; shared: number; categories: Map<string, number> }
  >();

  for (const expense of expenses) {
    const date = new Date(expense.transactionDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = byMonth.get(monthKey) ?? { total: 0, personal: 0, shared: 0, categories: new Map<string, number>() };

    current.total += expense.amount;
    if (expense.groupId) {
      current.shared += expense.amount;
    } else {
      current.personal += expense.amount;
    }
    const categoryName = expense.category.trim() || 'Other';
    current.categories.set(categoryName, (current.categories.get(categoryName) ?? 0) + expense.amount);
    byMonth.set(monthKey, current);
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .map(([monthKey, values]) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(Number(year), Number(month) - 1, 1);
      return {
        month: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        total: Number(values.total.toFixed(2)),
        personal: Number(values.personal.toFixed(2)),
        shared: Number(values.shared.toFixed(2)),
        categories: Array.from(values.categories.entries())
          .map(([name, total]) => ({ name, total: Number(total.toFixed(2)) }))
          .sort((left, right) => right.total - left.total),
      };
    });
};
