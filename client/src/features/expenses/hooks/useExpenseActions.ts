import { useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';
import { ADD_EXPENSE, DELETE_EXPENSE, UPDATE_EXPENSE } from '../graphql';
import type { AddExpenseInput, UpdateExpenseInput } from '../types';

export const useExpenseActions = (refetchQuery: DocumentNode) => {
  const [add, { loading: adding }] = useMutation(ADD_EXPENSE, {
    refetchQueries: [{ query: refetchQuery }],
  });

  const [update, { loading: updating }] = useMutation(UPDATE_EXPENSE, {
    refetchQueries: [{ query: refetchQuery }],
  });

  const [remove, { loading: deleting }] = useMutation(DELETE_EXPENSE, {
    refetchQueries: [{ query: refetchQuery }],
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
