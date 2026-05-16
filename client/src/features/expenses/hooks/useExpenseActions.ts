import { useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { GET_GROUPS } from '../../groups/graphql';
import { addExpenseToCache, removeExpenseFromCache, updateExpenseInCache } from '../expenseCacheUpdates';
import { ADD_EXPENSE, DELETE_EXPENSE, UPDATE_EXPENSE } from '../graphql';
import type { AddExpenseInput, Expense, UpdateExpenseInput } from '../types';

type AddExpenseMutationData = {
  addExpense: Expense;
};

type UpdateExpenseMutationData = {
  updateExpense: Expense;
};

type UseExpenseActionsOptions = {
  /** Refetch these queries after mutation (e.g. GET_GROUPS when group summaries embed expenses). */
  refetchQueries?: DocumentNode[];
};

export const useExpenseActions = (options?: UseExpenseActionsOptions) => {
  const refetchDocuments = [GET_GROUPS, ...(options?.refetchQueries ?? [])];
  const refetchQueries = refetchDocuments.map((query) => ({ query }));

  const [add, { loading: adding }] = useMutation<AddExpenseMutationData>(ADD_EXPENSE, {
    update(cache, { data }) {
      addExpenseToCache(cache, data?.addExpense ?? null);
    },
    refetchQueries,
  });

  const [update, { loading: updating }] = useMutation<UpdateExpenseMutationData>(UPDATE_EXPENSE, {
    update(cache, { data }) {
      updateExpenseInCache(cache, data?.updateExpense ?? null);
    },
    refetchQueries,
  });

  const [remove, { loading: deleting }] = useMutation(DELETE_EXPENSE, {
    update(cache, _result, { variables }) {
      const id = variables?.input?.id;
      if (typeof id === 'string') {
        removeExpenseFromCache(cache, id);
      }
    },
    refetchQueries,
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
