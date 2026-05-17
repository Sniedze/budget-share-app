import type { ApolloCache } from '@apollo/client';
import { GET_HOUSEHOLD_SETTLEMENTS } from './graphql';
import type { GetHouseholdSettlementsResponse, HouseholdSettlement } from '../../graphql/operationTypes';
import type { SettlementPeriodValue } from './settlementPeriod';

export const mergeHouseholdSettlementInCache = (
  cache: ApolloCache,
  period: SettlementPeriodValue,
  settlement: HouseholdSettlement,
): void => {
  cache.updateQuery<GetHouseholdSettlementsResponse>(
    { query: GET_HOUSEHOLD_SETTLEMENTS, variables: { period } },
    (existing) => {
      if (!existing) {
        return { householdSettlements: [settlement] };
      }
      const hasGroup = existing.householdSettlements.some((row) => row.groupId === settlement.groupId);
      if (!hasGroup) {
        return { householdSettlements: [...existing.householdSettlements, settlement] };
      }
      return {
        householdSettlements: existing.householdSettlements.map((row) =>
          row.groupId === settlement.groupId ? settlement : row,
        ),
      };
    },
  );
};
