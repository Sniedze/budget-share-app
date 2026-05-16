import type { ApolloClient } from '@apollo/client';
import { GET_GROUPS } from './graphql';

/** Refetch household groups after expenses change (totals / expense lists on Household). */
export const refetchGroups = async (client: ApolloClient): Promise<void> => {
  await client.refetchQueries({ include: [GET_GROUPS] });
};
