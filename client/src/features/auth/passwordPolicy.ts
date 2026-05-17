/** Mirrors server register/change-password rules for client-side UX. */
export const isPasswordStrong = (password: string): boolean => {
  if (password.length < 8) {
    return false;
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return false;
  }
  return new TextEncoder().encode(password).length <= 72;
};

export const passwordPolicyHint =
  'At least 8 characters with one letter and one number (max 72 bytes).';
