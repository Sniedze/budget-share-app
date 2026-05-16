import { gql } from '@apollo/client';
import { EXPENSE_FIELDS } from './expenseFields';

export { EXPENSE_FIELDS };

export const GET_EXPENSES = gql`
  ${EXPENSE_FIELDS}
  query GetExpenses {
    expenses {
      ...ExpenseFields
    }
  }
`;

export const ADD_EXPENSE = gql`
  ${EXPENSE_FIELDS}
  mutation AddExpense($input: AddExpenseInput!) {
    addExpense(input: $input) {
      ...ExpenseFields
    }
  }
`;

export const IMPORT_EXPENSES = gql`
  ${EXPENSE_FIELDS}
  mutation ImportExpenses($input: ImportExpensesInput!) {
    importExpenses(input: $input) {
      importedCount
      failedCount
      results {
        clientRowId
        success
        errorCode
        errorMessage
        expense {
          ...ExpenseFields
        }
      }
    }
  }
`;

export const UPDATE_EXPENSE = gql`
  ${EXPENSE_FIELDS}
  mutation UpdateExpense($input: UpdateExpenseInput!) {
    updateExpense(input: $input) {
      ...ExpenseFields
    }
  }
`;

export const DELETE_EXPENSE = gql`
  mutation DeleteExpense($input: DeleteExpenseInput!) {
    deleteExpense(input: $input)
  }
`;
