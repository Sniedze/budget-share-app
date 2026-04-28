import { gql } from '@apollo/client';

export const GET_EXPENSES = gql`
  query GetExpenses {
    expenses {
      id
      title
      amount
      createdAt
      transactionDate
      category
      split
      splitDetails {
        participant
        ratio
        amount
      }
    }
  }
`;

export const ADD_EXPENSE = gql`
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) {
      id
      title
      amount
      createdAt
      transactionDate
      category
      split
      splitDetails {
        participant
        ratio
        amount
      }
    }
  }
`;

export const UPDATE_EXPENSE = gql`
  mutation UpdateExpense($input: UpdateExpenseInput!) {
    updateExpense(input: $input) {
      id
      title
      amount
      createdAt
      transactionDate
      category
      split
      splitDetails {
        participant
        ratio
        amount
      }
    }
  }
`;

export const DELETE_EXPENSE = gql`
  mutation DeleteExpense($input: DeleteExpenseInput!) {
    deleteExpense(input: $input)
  }
`;
