const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty12',
  'qwerty123',
  'letmein1',
  'welcome1',
  'admin123',
  'iloveyou1',
  'sunshine1',
  'football1',
  'baseball1',
  'monkey123',
  'dragon12',
  'master12',
  'trustno1',
  'passw0rd',
  'passw0rd1',
  'changeme1',
  'secret12',
  'abc12345',
  'aa123456',
  'budget12',
  'budget123',
]);

/** Mirrors server register/change-password rules for client-side UX. */
export const isPasswordStrong = (password: string): boolean => {
  if (password.length < 8) {
    return false;
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return false;
  }
  if (new TextEncoder().encode(password).length > 72) {
    return false;
  }
  return !COMMON_PASSWORDS.has(password.trim().toLowerCase());
};

export const passwordPolicyHint =
  'At least 8 characters with one letter and one number; avoid common passwords (max 72 bytes).';
