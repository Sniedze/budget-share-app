import type {
  ExpenseGroupSettlement,
  GetHouseholdSettlementsQuery,
  HouseholdSettlement,
  SettlementBalance,
  SettlementPayment,
  SettlementTransfer,
} from '../../graphql/generated/graphql';

export type {
  ExpenseGroupSettlement,
  HouseholdSettlement,
  SettlementBalance,
  SettlementPayment,
  SettlementTransfer,
};

export type GetHouseholdSettlementsResponse = GetHouseholdSettlementsQuery;
