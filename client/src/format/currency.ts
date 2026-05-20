/** Default currency for new expenses and single-currency summaries (budget, settlements). */
export const APP_CURRENCY_CODE = 'DKK';

const formatterCache = new Map<string, Intl.NumberFormat>();
const amountFormatterCache = new Map<string, Intl.NumberFormat>();

const getAmountFormatter = (localeKey: string): Intl.NumberFormat => {
  const cached = amountFormatterCache.get(localeKey);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(localeKey === 'da-DK' ? 'da-DK' : undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  amountFormatterCache.set(localeKey, formatter);
  return formatter;
};

const getCurrencyFormatter = (currencyCode: string): Intl.NumberFormat => {
  const code = currencyCode.trim().toUpperCase() || APP_CURRENCY_CODE;
  const cached = formatterCache.get(code);
  if (cached) {
    return cached;
  }
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    formatter = new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: APP_CURRENCY_CODE,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  formatterCache.set(code, formatter);
  return formatter;
};

export const formatCurrency = (value: number, currencyCode: string = APP_CURRENCY_CODE): string =>
  getCurrencyFormatter(currencyCode).format(value);

/** Format using the app default currency (DKK). */
export const formatAppCurrency = (value: number): string => formatCurrency(value, APP_CURRENCY_CODE);

/** Numeric amount only (no currency symbol), for table cells when the column header shows the currency. */
export const formatCurrencyAmount = (value: number, currencyCode: string = APP_CURRENCY_CODE): string => {
  const code = currencyCode.trim().toUpperCase() || APP_CURRENCY_CODE;
  const localeKey = code === 'DKK' ? 'da-DK' : 'default';
  return getAmountFormatter(localeKey).format(value);
};

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
