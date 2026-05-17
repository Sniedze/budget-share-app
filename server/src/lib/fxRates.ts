import { appError, ErrorCode } from '../graphql/appError.js';
import { normalizeExpenseCurrency } from './currency.js';

type RatesCache = {
  base: string;
  rates: Record<string, number>;
  fetchedAt: number;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: RatesCache | null = null;

const fetchRatesForBase = async (base: string): Promise<Record<string, number>> => {
  const now = Date.now();
  if (cache && cache.base === base && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  const response = await fetch(
    `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Exchange rates are temporarily unavailable.');
  }

  const payload = (await response.json()) as { rates?: Record<string, number> };
  const rates = payload.rates ?? {};
  cache = { base, rates: { ...rates, [base]: 1 }, fetchedAt: now };
  return cache.rates;
};

/** Returns multiplier to convert `amount` from `from` currency into `to` currency. */
export const getFxRate = async (from: string, to: string): Promise<number> => {
  const fromCode = normalizeExpenseCurrency(from);
  const toCode = normalizeExpenseCurrency(to);
  if (fromCode === toCode) {
    return 1;
  }
  const ratesFromBase = await fetchRatesForBase(fromCode);
  const direct = ratesFromBase[toCode];
  if (direct !== undefined && Number.isFinite(direct)) {
    return direct;
  }
  throw appError(
    ErrorCode.BAD_USER_INPUT,
    `No exchange rate available for ${fromCode} → ${toCode}.`,
  );
};

export const convertAmount = async (
  amount: number,
  from: string,
  to: string,
): Promise<number> => {
  const rate = await getFxRate(from, to);
  return Number((amount * rate).toFixed(2));
};
