import type { AuthTokens } from './types';

const ACCESS_TOKEN_KEY = 'budgetshare.accessToken';
const REFRESH_TOKEN_KEY = 'budgetshare.refreshToken';
const REMEMBER_ME_KEY = 'budgetshare.rememberMe';

const readToken = (key: string): string | null => {
  const localValue = localStorage.getItem(key);
  if (localValue) {
    return localValue;
  }
  return sessionStorage.getItem(key);
};

export const getAccessToken = (): string | null => readToken(ACCESS_TOKEN_KEY);
export const getRefreshToken = (): string | null => readToken(REFRESH_TOKEN_KEY);
export const getRememberMe = (): boolean => localStorage.getItem(REMEMBER_ME_KEY) === 'true';

export const getStoredTokens = (): AuthTokens | null => {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
};

export const setStoredTokens = (tokens: AuthTokens, options?: { remember?: boolean }): void => {
  const remember = options?.remember ?? true;
  const storage = remember ? localStorage : sessionStorage;
  const alternateStorage = remember ? sessionStorage : localStorage;

  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  localStorage.setItem(REMEMBER_ME_KEY, String(remember));

  alternateStorage.removeItem(ACCESS_TOKEN_KEY);
  alternateStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const clearStoredTokens = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(REMEMBER_ME_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
};
