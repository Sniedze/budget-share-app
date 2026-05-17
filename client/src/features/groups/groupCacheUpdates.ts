import type { ApolloCache, ApolloClient } from '@apollo/client';
import { GET_GROUPS } from './graphql';
import type { GetGroupsQueryResult, GroupSummary } from './types';

export const mergeGroupIntoCache = (cache: ApolloCache, group: GroupSummary | null | undefined): void => {
  if (!group) {
    return;
  }
  cache.updateQuery<GetGroupsQueryResult>({ query: GET_GROUPS }, (existing) => {
    if (!existing) {
      return { groups: [group] };
    }
    if (existing.groups.some((row) => row.id === group.id)) {
      return {
        groups: existing.groups.map((row) => (row.id === group.id ? group : row)),
      };
    }
    return { groups: [group, ...existing.groups] };
  });
};

/** Refetch household groups after expenses change (totals / expense lists on Household). */
export const refetchGroups = async (client: ApolloClient): Promise<void> => {
  await client.refetchQueries({ include: [GET_GROUPS] });
};
