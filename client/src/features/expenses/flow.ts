import type { Expense } from './types';

export type ExpenseFlow = 'Outgoing' | 'Incoming';

export const normalizeExpenseFlow = (raw: string | null | undefined): ExpenseFlow =>
  raw === 'Incoming' ? 'Incoming' : 'Outgoing';

export const isOutgoingExpense = (expense: Expense): boolean =>
  normalizeExpenseFlow(expense.flow) === 'Outgoing';

export const outgoingExpensesOnly = (expenses: Expense[]): Expense[] =>
  expenses.filter(isOutgoingExpense);

export const incomingExpensesOnly = (expenses: Expense[]): Expense[] =>
  expenses.filter((e) => normalizeExpenseFlow(e.flow) === 'Incoming');
