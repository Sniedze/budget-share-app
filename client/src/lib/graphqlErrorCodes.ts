export const GraphqlErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',
} as const;

export type GraphqlErrorExtensions = {
  code?: string;
};

export type GraphqlErrorShape = {
  message?: string;
  extensions?: GraphqlErrorExtensions;
};

export const getGraphqlErrorCode = (error: GraphqlErrorShape | undefined): string | undefined => {
  const code = error?.extensions?.code;
  return typeof code === 'string' ? code : undefined;
};

export const isUnauthenticatedGraphqlError = (error: GraphqlErrorShape | undefined): boolean =>
  getGraphqlErrorCode(error) === GraphqlErrorCode.UNAUTHENTICATED;

export const isDuplicateTransactionGraphqlError = (error: GraphqlErrorShape | undefined): boolean =>
  getGraphqlErrorCode(error) === GraphqlErrorCode.DUPLICATE_TRANSACTION;
