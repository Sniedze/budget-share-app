/** Matches server `SESSION_HINT_COOKIE_NAME` (non-secret presence flag). */
export const SESSION_HINT_COOKIE_NAME = 'budgetshare_session';

export const hasSessionHintCookie = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.cookie.includes(`${SESSION_HINT_COOKIE_NAME}=1`);
};
