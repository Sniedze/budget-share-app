/**
 * Legacy token keys from localStorage/sessionStorage (pre–httpOnly cookies).
 * Kept so upgrades clear old secrets from the browser.
 */
const ACCESS_TOKEN_KEY = 'budgetshare.accessToken';
const REFRESH_TOKEN_KEY = 'budgetshare.refreshToken';
const REMEMBER_ME_KEY = 'budgetshare.rememberMe';

export const clearStoredTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};
