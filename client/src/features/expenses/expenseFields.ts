import { gql } from '@apollo/client';

export const EXPENSE_FIELDS = gql`
  fragment ExpenseFields on Expense {
    id
    title
    amount
    currency
    createdAt
    transactionDate
    category
    expenseGroup
    split
    groupId
    createdByUserId
    paidByUserId
    isPrivate
    flow
    splitDetails {
      participant
      ratio
      amount
    }
  }
`;
