/**
 * Matches server `DUPLICATE_TRANSACTION_MESSAGE` (keep substring in sync for UI detection).
 */
export const BACKEND_DUPLICATE_EXPENSE_PREFIX = 'Duplicate transaction:';

export const getMutationErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const err = error as Error & {
      graphQLErrors?: ReadonlyArray<{ message?: string }>;
      networkError?: { result?: { errors?: ReadonlyArray<{ message?: string }> } };
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

export const isBackendDuplicateExpenseError = (message: string): boolean => {
  return message.trim().startsWith(BACKEND_DUPLICATE_EXPENSE_PREFIX);
};
