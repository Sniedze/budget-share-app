import type { ApolloCache, ApolloClient } from '@apollo/client';
import { GET_GROUPS } from './graphql';
import type { GetGroupsQueryResult, GroupPendingInvitation, GroupSummary } from './types';

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

export const patchGroupPendingInvitation = (
  cache: ApolloCache,
  groupId: string,
  invitation: GroupPendingInvitation,
): void => {
  cache.updateQuery<GetGroupsQueryResult>({ query: GET_GROUPS }, (existing) => {
    if (!existing) {
      return existing;
    }
    const normalizedEmail = invitation.email.trim().toLowerCase();
    return {
      groups: existing.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        const hasInvite = group.pendingInvitations.some(
          (row) => row.email.trim().toLowerCase() === normalizedEmail,
        );
        if (!hasInvite) {
          return {
            ...group,
            pendingInvitations: [...group.pendingInvitations, invitation],
          };
        }
        return {
          ...group,
          pendingInvitations: group.pendingInvitations.map((row) =>
            row.email.trim().toLowerCase() === normalizedEmail ? { ...row, ...invitation } : row,
          ),
        };
      }),
    };
  });
};

/** Refetch household groups after expenses change (totals / expense lists on Household). */
export const refetchGroups = async (client: ApolloClient): Promise<void> => {
  await client.refetchQueries({ include: [GET_GROUPS] });
};
