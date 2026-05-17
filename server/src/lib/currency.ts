import { appError, ErrorCode } from '../graphql/appError.js';

export const DEFAULT_CURRENCY = 'DKK';

/** Normalize to uppercase ISO 4217 code; defaults to DKK when omitted. */
export const normalizeExpenseCurrency = (input?: string | null): string => {
  const raw = (input ?? DEFAULT_CURRENCY).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(raw)) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Currency must be a 3-letter ISO code.');
  }
  return raw;
};
