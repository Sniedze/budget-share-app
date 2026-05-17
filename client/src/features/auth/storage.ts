import { removeFromStorage } from '../../lib/localStorageJson';
import { legacyAuthTokenKeys } from '../userSettings/workspaceStorageKeys';

/**
 * Legacy token keys from localStorage/sessionStorage (pre–httpOnly cookies).
 * Kept so upgrades clear old secrets from the browser.
 */
export const clearStoredTokens = (): void => {
  for (const key of legacyAuthTokenKeys) {
    removeFromStorage(key);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors.
    }
  }
};
