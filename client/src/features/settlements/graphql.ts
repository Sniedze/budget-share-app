import { gql } from '@apollo/client';

const HOUSEHOLD_SETTLEMENT_FIELDS = gql`
  fragment HouseholdSettlementFields on HouseholdSettlement {
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
`;

export const GET_HOUSEHOLD_SETTLEMENTS = gql`
  ${HOUSEHOLD_SETTLEMENT_FIELDS}
  query GetHouseholdSettlements($period: SettlementPeriod) {
    householdSettlements(period: $period) {
      ...HouseholdSettlementFields
    }
  }
`;

export const RECORD_SETTLEMENT_PAYMENT = gql`
  ${HOUSEHOLD_SETTLEMENT_FIELDS}
  mutation RecordSettlementPayment(
    $input: RecordSettlementPaymentInput!
    $period: SettlementPeriod
  ) {
    recordSettlementPayment(input: $input, period: $period) {
      payment {
        id
        groupId
        expenseGroup
        fromMember
        toMember
        amount
        note
        settledAt
      }
      householdSettlement {
        ...HouseholdSettlementFields
      }
    }
  }
`;
