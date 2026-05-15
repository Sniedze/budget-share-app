/** bcrypt truncates at 72 bytes; cap here for predictable behavior. */
import { appError, ErrorCode } from '../../graphql/appError.js';
import { stripControlCharacters } from '../../lib/sanitize.js';

export const MAX_PASSWORD_LENGTH = 72;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_FULL_NAME_LENGTH = 255;

export { stripControlCharacters };

/**
 * Practical email check (not full RFC 5322). ASCII-focused for typical logins.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

export const validateEmailFormat = (email: string, mode: 'login' | 'register'): void => {
  const loginMessage = 'Invalid email or password.';
  if (email.length === 0) {
    throw appError(
      mode === 'login' ? ErrorCode.UNAUTHENTICATED : ErrorCode.BAD_USER_INPUT,
      mode === 'login' ? loginMessage : 'Email is required.',
    );
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    throw appError(
      mode === 'login' ? ErrorCode.UNAUTHENTICATED : ErrorCode.BAD_USER_INPUT,
      mode === 'login' ? loginMessage : 'Email is too long.',
    );
  }
  if (!EMAIL_REGEX.test(email)) {
    throw appError(
      mode === 'login' ? ErrorCode.UNAUTHENTICATED : ErrorCode.BAD_USER_INPUT,
      mode === 'login' ? loginMessage : 'Enter a valid email address.',
    );
  }
};

export const normalizeFullNameForRegister = (fullName: string): string => {
  const stripped = stripControlCharacters(fullName).trim();
  if (stripped.length === 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Full name is required.');
  }
  if (stripped.length > MAX_FULL_NAME_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Full name is too long.');
  }
  return stripped;
};

export const assertPasswordAcceptableForRegister = (password: string): void => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Password must be at least 8 characters.');
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Password must be at most 72 bytes.');
  }
};

/** Reject huge payloads before bcrypt work; same error as bad credentials. */
export const assertPasswordLengthForLogin = (password: string): void => {
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid email or password.');
  }
};
