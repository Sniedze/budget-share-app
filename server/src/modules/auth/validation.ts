/** bcrypt truncates at 72 bytes; cap here for predictable behavior. */
export const MAX_PASSWORD_LENGTH = 72;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_EMAIL_LENGTH = 254;
export const MAX_FULL_NAME_LENGTH = 255;

/** Strip ASCII control characters (incl. newlines) from user-visible fields. */
export const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, '');

/**
 * Practical email check (not full RFC 5322). ASCII-focused for typical logins.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

export const validateEmailFormat = (email: string, mode: 'login' | 'register'): void => {
  if (email.length === 0) {
    throw new Error(mode === 'login' ? 'Invalid email or password.' : 'Email is required.');
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    throw new Error(mode === 'login' ? 'Invalid email or password.' : 'Email is too long.');
  }
  if (!EMAIL_REGEX.test(email)) {
    throw new Error(mode === 'login' ? 'Invalid email or password.' : 'Enter a valid email address.');
  }
};

export const normalizeFullNameForRegister = (fullName: string): string => {
  const stripped = stripControlCharacters(fullName).trim();
  if (stripped.length === 0) {
    throw new Error('Full name is required.');
  }
  if (stripped.length > MAX_FULL_NAME_LENGTH) {
    throw new Error('Full name is too long.');
  }
  return stripped;
};

export const assertPasswordAcceptableForRegister = (password: string): void => {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error('Password must be at least 8 characters.');
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Password must be at most 72 characters.');
  }
};

/** Reject huge payloads before bcrypt work; same error as bad credentials. */
export const assertPasswordLengthForLogin = (password: string): void => {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Invalid email or password.');
  }
};
