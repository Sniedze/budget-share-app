import { formatAppCurrency } from '../../../format/currency';
import type { Expense, GroupMember } from '../../../graphql/operationTypes';
import {
  type ExpenseViewerContext,
  getExpenseAttributableAmount,
  getExpensePersonalContribution,
  getExpenseSharedContribution,
} from './expenseAttribution';

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

type GroupNameInput = {
  name: string;
};

const isCurrentMonthExpense = (expense: Expense): boolean => {
  const date = new Date(expense.transactionDate);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const formatPercentOfTotal = (part: number, total: number): string => {
  if (total <= 0) {
    return '0% of total';
  }
  return `${Math.round((part / total) * 100)}% of total`;
};

const formatActiveGroupsHint = (groups: GroupNameInput[]): string => {
  if (groups.length === 0) {
    return 'No households yet';
  }

  const names = groups.map((group) => group.name.trim()).filter((name) => name.length > 0);
  if (names.length === 0) {
    return 'No households yet';
  }

  const maxNames = 3;
  if (names.length <= maxNames) {
    return names.join(', ');
  }

  const shown = names.slice(0, maxNames).join(', ');
  const remaining = names.length - maxNames;
  return `${shown}, +${remaining} more`;
};

type DashboardStatsInput = {
  expenses: Expense[];
  groups: GroupNameInput[];
  viewer: ExpenseViewerContext;
  membersByGroupId: Map<string, GroupMember[]>;
};

export const getDashboardStats = ({
  expenses,
  groups,
  viewer,
  membersByGroupId,
}: DashboardStatsInput): DashboardStat[] => {
  const monthExpenses = expenses.filter(isCurrentMonthExpense);
  let personalAmount = 0;
  let sharedAmount = 0;

  for (const expense of monthExpenses) {
    personalAmount += getExpensePersonalContribution(expense, viewer);
    sharedAmount += getExpenseSharedContribution(expense, viewer, membersByGroupId);
  }

  const totalAmount = Number((personalAmount + sharedAmount).toFixed(2));
  personalAmount = Number(personalAmount.toFixed(2));
  sharedAmount = Number(sharedAmount.toFixed(2));

  return [
    {
      label: 'Total This Month',
      value: formatAppCurrency(totalAmount),
      hint: 'Your personal spending plus your household share',
    },
    {
      label: 'Personal Expenses',
      value: formatAppCurrency(personalAmount),
      hint: formatPercentOfTotal(personalAmount, totalAmount),
    },
    {
      label: 'Shared Expenses',
      value: formatAppCurrency(sharedAmount),
      hint: formatPercentOfTotal(sharedAmount, totalAmount),
    },
    {
      label: 'Active Groups',
      value: String(groups.length),
      hint: formatActiveGroupsHint(groups),
    },
  ];
};

type AttributedAnalyticsInput = {
  expenses: Expense[];
  viewer: ExpenseViewerContext;
  membersByGroupId: Map<string, GroupMember[]>;
};

export const getTrendData = ({ expenses, viewer, membersByGroupId }: AttributedAnalyticsInput): TrendPoint[] => {
  const byMonth = new Map<string, number>();

  for (const expense of expenses) {
    const date = new Date(expense.transactionDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const attributable = getExpenseAttributableAmount(expense, viewer, membersByGroupId);
    byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + attributable);
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

export const getBreakdownData = ({ expenses, viewer, membersByGroupId }: AttributedAnalyticsInput): BreakdownPoint[] => {
  const byTitle = new Map<string, number>();

  for (const expense of expenses) {
    const key = expense.category.trim() || 'Other';
    const attributable = getExpenseAttributableAmount(expense, viewer, membersByGroupId);
    byTitle.set(key, (byTitle.get(key) ?? 0) + attributable);
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

export const getMonthlyOverview = ({
  expenses,
  viewer,
  membersByGroupId,
}: AttributedAnalyticsInput): MonthlyOverviewPoint[] => {
  const byMonth = new Map<
    string,
    { total: number; personal: number; shared: number; categories: Map<string, number> }
  >();

  for (const expense of expenses) {
    const date = new Date(expense.transactionDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const current = byMonth.get(monthKey) ?? { total: 0, personal: 0, shared: 0, categories: new Map<string, number>() };

    const personalContribution = getExpensePersonalContribution(expense, viewer);
    const sharedContribution = getExpenseSharedContribution(expense, viewer, membersByGroupId);
    const attributable = personalContribution + sharedContribution;

    current.total += attributable;
    current.personal += personalContribution;
    current.shared += sharedContribution;
    const categoryName = expense.category.trim() || 'Other';
    current.categories.set(categoryName, (current.categories.get(categoryName) ?? 0) + attributable);
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
