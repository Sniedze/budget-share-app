import { GraphQLError } from 'graphql';

export const ErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  BAD_USER_INPUT: 'BAD_USER_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends GraphQLError {
  constructor(code: ErrorCodeValue, message: string) {
    super(message, { extensions: { code } });
  }
}

export const appError = (code: ErrorCodeValue, message: string): AppError => new AppError(code, message);
