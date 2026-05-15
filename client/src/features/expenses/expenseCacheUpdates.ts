import type { ApolloCache } from '@apollo/client';
import { GET_EXPENSES } from './graphql';
import type { Expense, GetExpensesResponse } from './types';

export const addExpenseToCache = (cache: ApolloCache, expense: Expense | null | undefined): void => {
  if (!expense) {
    return;
  }
  cache.updateQuery<GetExpensesResponse>({ query: GET_EXPENSES }, (existing) => {
    if (!existing) {
      return { expenses: [expense] };
    }
    if (existing.expenses.some((row: Expense) => row.id === expense.id)) {
      return existing;
    }
    return { expenses: [expense, ...existing.expenses] };
  });
};

export const updateExpenseInCache = (cache: ApolloCache, expense: Expense | null | undefined): void => {
  if (!expense) {
    return;
  }
  cache.updateQuery<GetExpensesResponse>({ query: GET_EXPENSES }, (existing) => {
    if (!existing) {
      return existing;
    }
    return {
      expenses: existing.expenses.map((row: Expense) => (row.id === expense.id ? expense : row)),
    };
  });
};

export const removeExpenseFromCache = (cache: ApolloCache, expenseId: string): void => {
  cache.updateQuery<GetExpensesResponse>({ query: GET_EXPENSES }, (existing) => {
    if (!existing) {
      return existing;
    }
    return {
      expenses: existing.expenses.filter((row: Expense) => row.id !== expenseId),
    };
  });
};
