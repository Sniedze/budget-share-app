import { gql } from '@apollo/client';

export const GET_HOUSEHOLD_SETTLEMENTS = gql`
  query GetHouseholdSettlements($period: SettlementPeriod) {
    householdSettlements(period: $period) {
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
      mixedCurrencyWarning
      currencyScopes {
        currency
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
