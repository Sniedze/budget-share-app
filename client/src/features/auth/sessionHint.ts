/** Matches server `SESSION_HINT_COOKIE_NAME` (non-httpOnly; Path=/). */
export const SESSION_HINT_COOKIE_NAME = 'budgetshare_session';

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }
    const raw = trimmed.slice(prefix.length);
    if (raw.length === 0) {
      return null;
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
};

/** True when the API set a session hint cookie (skip `me` when absent). */
export const hasSessionHintCookie = (): boolean => {
  const value = readCookie(SESSION_HINT_COOKIE_NAME);
  return value !== null && value.length > 0;
};
