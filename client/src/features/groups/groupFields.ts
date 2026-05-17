import { gql } from '@apollo/client';

/** Shared household group fields for list and mutation responses. */
export const GROUP_FIELDS = gql`
  fragment GroupFields on Group {
    id
    name
    description
    totalSpent
    yourShare
    expenseGroupLabels
    pendingInvitations {
      email
      name
      status
      emailDeliveryStatus
    }
    members {
      userId
      name
      email
      ratio
    }
    expenses {
      date
      expenseGroup
      category
      description
      paidBy
      total
      yourShare
      isPrivate
      currency
    }
  }
`;
