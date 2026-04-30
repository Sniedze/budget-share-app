import { gql } from '@apollo/client';

export const GET_HOUSEHOLD_SETTLEMENTS = gql`
  query GetHouseholdSettlements {
    householdSettlements {
      groupId
      groupName
      balances {
        memberName
        amount
      }
      transfers {
        fromMember
        toMember
        amount
      }
      expenseGroups {
        expenseGroup
        totalExpenses
        balances {
          memberName
          amount
        }
        transfers {
          fromMember
          toMember
          amount
        }
      }
      payments {
        id
        groupId
        expenseGroup
        fromMember
        toMember
        amount
        note
        settledAt
      }
    }
  }
`;

export const RECORD_SETTLEMENT_PAYMENT = gql`
  mutation RecordSettlementPayment($input: RecordSettlementPaymentInput!) {
    recordSettlementPayment(input: $input) {
      id
      groupId
      expenseGroup
      fromMember
      toMember
      amount
      note
      settledAt
    }
  }
`;
