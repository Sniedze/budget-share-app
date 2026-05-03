/** Single app currency — amounts in the database are stored in this unit. */
export const APP_CURRENCY_CODE = 'DKK';

const appCurrencyFormatter = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: APP_CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatAppCurrency = (value: number): string => appCurrencyFormatter.format(value);

/**
 * Normalize a bank statement currency cell to a 3-letter ISO-style code.
 * Empty / missing values default to the app currency (DKK).
 */
export const normalizeStatementCurrency = (raw: string): string => {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) {
    return APP_CURRENCY_CODE;
  }
  if (trimmed === 'KR' || trimmed === 'KR.' || trimmed === 'DKK' || trimmed === 'DKR') {
    return APP_CURRENCY_CODE;
  }
  const lettersOnly = trimmed.replace(/[^A-Z]/g, '');
  if (lettersOnly === 'DKK' || lettersOnly === 'KR') {
    return APP_CURRENCY_CODE;
  }
  const wordMatch = trimmed.match(/\b([A-Z]{3})\b/);
  if (wordMatch) {
    return wordMatch[1];
  }
  if (lettersOnly.length >= 3) {
    return lettersOnly.slice(0, 3);
  }
  return APP_CURRENCY_CODE;
};
