import { isDuplicateTransactionGraphqlError, type GraphqlErrorShape } from '../../lib/graphqlErrorCodes';

export const getMutationErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const err = error as Error & {
      graphQLErrors?: ReadonlyArray<GraphqlErrorShape>;
      networkError?: { result?: { errors?: ReadonlyArray<GraphqlErrorShape> } };
    };
    const gql = err.graphQLErrors?.[0]?.message;
    if (gql) {
      return gql;
    }
    const net = err.networkError?.result?.errors?.[0]?.message;
    if (net) {
      return net;
    }
    return err.message;
  }
  return 'Import failed';
};

export const isDuplicateImportResult = (result: {
  errorCode?: string | null;
  errorMessage?: string | null;
}): boolean => result.errorCode === 'DUPLICATE_TRANSACTION';

export const isBackendDuplicateExpenseError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const err = error as Error & { graphQLErrors?: ReadonlyArray<GraphqlErrorShape> };
    const gqlError = err.graphQLErrors?.[0];
    if (gqlError && isDuplicateTransactionGraphqlError(gqlError)) {
      return true;
    }
  }
  return false;
};
