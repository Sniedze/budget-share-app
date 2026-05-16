import { useApolloClient, useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { refetchGroups } from '../../groups/groupCacheUpdates';
import { addExpenseToCache, removeExpenseFromCache, updateExpenseInCache } from '../expenseCacheUpdates';
import { GET_EXPENSES, ADD_EXPENSE, DELETE_EXPENSE, UPDATE_EXPENSE } from '../graphql';
import type { AddExpenseInput, Expense, GetExpensesResponse, UpdateExpenseInput } from '../types';

type AddExpenseMutationData = {
  addExpense: Expense;
};

type UpdateExpenseMutationData = {
  updateExpense: Expense;
};

type UseExpenseActionsOptions = {
  /** Extra queries to refetch after mutation (prefer cache updates when possible). */
  refetchQueries?: DocumentNode[];
};

export const useExpenseActions = (options?: UseExpenseActionsOptions) => {
  const client = useApolloClient();
  const extraRefetchQueries =
    options?.refetchQueries?.map((query) => ({ query })) ?? [];

  const refetchGroupsIfHouseholdExpense = async (expense: Expense | null | undefined): Promise<void> => {
    if (expense?.groupId) {
      await refetchGroups(client);
    }
  };

  const [add, { loading: adding }] = useMutation<AddExpenseMutationData>(ADD_EXPENSE, {
    update(cache, { data }) {
      const expense = data?.addExpense ?? null;
      addExpenseToCache(cache, expense);
      void refetchGroupsIfHouseholdExpense(expense);
    },
    refetchQueries: extraRefetchQueries,
  });

  const [update, { loading: updating }] = useMutation<UpdateExpenseMutationData>(UPDATE_EXPENSE, {
    update(cache, { data }) {
      const expense = data?.updateExpense ?? null;
      updateExpenseInCache(cache, expense);
      void refetchGroupsIfHouseholdExpense(expense);
    },
    refetchQueries: extraRefetchQueries,
  });

  const [remove, { loading: deleting }] = useMutation(DELETE_EXPENSE, {
    update(cache, _result, { variables }) {
      const id = variables?.input?.id;
      if (typeof id !== 'string') {
        return;
      }
      const existing = cache.readQuery<GetExpensesResponse>({ query: GET_EXPENSES });
      const removed = existing?.expenses.find((row) => row.id === id);
      removeExpenseFromCache(cache, id);
      void refetchGroupsIfHouseholdExpense(removed);
    },
    refetchQueries: extraRefetchQueries,
  });

  const addExpense = async (input: AddExpenseInput) => {
    await add({ variables: { input } });
  };

  const updateExpense = async (input: UpdateExpenseInput) => {
    await update({ variables: { input } });
  };

  const deleteExpense = async (id: string) => {
    await remove({ variables: { input: { id } } });
  };

  return {
    addExpense,
    updateExpense,
    deleteExpense,
    isMutating: adding || updating || deleting,
  };
};
