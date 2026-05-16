import type { GraphQLFormattedError } from 'graphql';
import { logServerError } from '../logger.js';
import { getCurrentRequestId } from '../middleware/requestContext.js';
import { ErrorCode, type ErrorCodeValue } from './appError.js';

const CLIENT_SAFE_CODES = new Set<ErrorCodeValue>([
  ErrorCode.UNAUTHENTICATED,
  ErrorCode.FORBIDDEN,
  ErrorCode.BAD_USER_INPUT,
  ErrorCode.NOT_FOUND,
  ErrorCode.CONFLICT,
  ErrorCode.DUPLICATE_TRANSACTION,
]);

const readErrorCode = (formattedError: GraphQLFormattedError): string | undefined => {
  const code = formattedError.extensions?.code;
  return typeof code === 'string' ? code : undefined;
};

const isDevelopment = (process.env.NODE_ENV ?? 'development') !== 'production';

export const formatGraphqlError = (
  formattedError: GraphQLFormattedError,
): GraphQLFormattedError => {
  const requestId = getCurrentRequestId() ?? 'unknown';
  const code = readErrorCode(formattedError);
  const isClientSafe = code !== undefined && CLIENT_SAFE_CODES.has(code as ErrorCodeValue);

  if (!isClientSafe) {
    logServerError({
      requestId,
      method: 'POST',
      path: '/graphql',
      statusCode: 500,
      message: formattedError.message,
    });
    return {
      message: isDevelopment ? formattedError.message : 'Internal server error.',
      extensions: {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        requestId,
      },
      locations: formattedError.locations,
      path: formattedError.path,
    };
  }

  return {
    ...formattedError,
    extensions: {
      ...formattedError.extensions,
      code,
      requestId,
    },
  };
};
