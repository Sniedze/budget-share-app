/** Strip ASCII control characters (incl. newlines) from user-visible fields. */
export const stripControlCharacters = (value: string): string =>
  value.replace(/[\u0000-\u001F\u007F]/g, '');

/** Safe for plain-text email bodies (no header injection via newlines). */
export const sanitizeEmailPlainText = (value: string): string => stripControlCharacters(value).trim();
