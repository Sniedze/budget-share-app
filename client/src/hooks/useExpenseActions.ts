import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import type { DocumentNode } from 'graphql';

const ADD_EXPENSE = gql`
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) {
      id
      title
      amount
      createdAt
      transactionDate
      category
      split
    }
  }
`;

const UPDATE_EXPENSE = gql`
  mutation UpdateExpense($input: UpdateExpenseInput!) {
    updateExpense(input: $input) {
      id
      title
      amount
      createdAt
      transactionDate
      category
      split
    }
  }
`;

const DELETE_EXPENSE = gql`
  mutation DeleteExpense($input: DeleteExpenseInput!) {
    deleteExpense(input: $input)
  }
`;

type AddInput = {
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  split: string;
};
type UpdateInput = {
  id: string;
  title: string;
  amount: number;
  transactionDate: string;
  category: string;
  split: string;
};

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

  const addExpense = async (input: AddInput) => {
    await add({ variables: { input } });
  };

  const updateExpense = async (input: UpdateInput) => {
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
