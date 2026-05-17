/** bcrypt truncates at 72 bytes; cap here for predictable behavior. */
import { appError, ErrorCode } from '../../graphql/appError.js';
import { stripControlCharacters } from '../../lib/sanitize.js';
import { isCommonPassword } from './commonPasswords.js';
import { isHibpPasswordCheckEnabled, isPasswordBreached } from './hibp.js';

export const MAX_PASSWORD_LENGTH = 72;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_FULL_NAME_LENGTH = 255;
export const MAX_PHONE_LENGTH = 32;
export const MAX_TIMEZONE_LENGTH = 64;

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

export const normalizeOptionalPhone = (phone: string | null | undefined): string | null => {
  const stripped = stripControlCharacters(phone ?? '').trim();
  if (stripped.length === 0) {
    return null;
  }
  if (stripped.length > MAX_PHONE_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Phone number is too long.');
  }
  if (!/^[\d\s+().-]+$/.test(stripped)) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Enter a valid phone number.');
  }
  return stripped;
};

export const normalizeTimezone = (timezone: string): string => {
  const stripped = stripControlCharacters(timezone).trim();
  if (stripped.length === 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Timezone is required.');
  }
  if (stripped.length > MAX_TIMEZONE_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Timezone is too long.');
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: stripped });
  } catch {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Enter a valid IANA timezone (e.g. Europe/Copenhagen).');
  }
  return stripped;
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

/** Register and password-change rules (length + letter and digit). */
export const assertPasswordStrength = (password: string): void => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Password must be at least 8 characters.');
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Password must be at most 72 bytes.');
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw appError(
      ErrorCode.BAD_USER_INPUT,
      'Password must include at least one letter and one number.',
    );
  }
};

export const assertPasswordNotCommon = (password: string): void => {
  if (isCommonPassword(password)) {
    throw appError(
      ErrorCode.BAD_USER_INPUT,
      'That password is too common. Choose something less predictable.',
    );
  }
};

export const assertPasswordNotBreached = async (password: string): Promise<void> => {
  if (!isHibpPasswordCheckEnabled()) {
    return;
  }
  const breached = await isPasswordBreached(password);
  if (breached) {
    throw appError(
      ErrorCode.BAD_USER_INPUT,
      'That password has appeared in a data breach. Choose a different password.',
    );
  }
};

export const assertPasswordAcceptableForRegister = async (password: string): Promise<void> => {
  assertPasswordStrength(password);
  assertPasswordNotCommon(password);
  await assertPasswordNotBreached(password);
};

export const assertNewPasswordRules = async (password: string): Promise<void> => {
  assertPasswordStrength(password);
  assertPasswordNotCommon(password);
  await assertPasswordNotBreached(password);
};

export const assertCurrentPasswordForChange = (password: string): void => {
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Current password is incorrect.');
  }
};

/** Reject huge payloads before bcrypt work; same error as bad credentials. */
export const assertPasswordLengthForLogin = (password: string): void => {
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid email or password.');
  }
};
