import type { ApolloCache } from '@apollo/client';
import { GET_EXPENSES } from './graphql';
import type { Expense, GetExpensesResponse } from '../../graphql/operationTypes';

export const mergeImportedExpensesIntoCache = (cache: ApolloCache, expenses: Expense[]): void => {
  if (expenses.length === 0) {
    return;
  }
  cache.updateQuery<GetExpensesResponse>({ query: GET_EXPENSES }, (existing) => {
    const knownIds = new Set(existing?.expenses.map((row) => row.id) ?? []);
    const toAdd = expenses.filter((expense) => !knownIds.has(expense.id));
    if (toAdd.length === 0) {
      return existing;
    }
    if (!existing) {
      return { expenses: toAdd };
    }
    return { expenses: [...toAdd, ...existing.expenses] };
  });
};

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
