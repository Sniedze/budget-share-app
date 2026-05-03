import { createHash } from 'node:crypto';

const roundToCents = (value: number): number => Math.round(value * 100) / 100;

/** Lowercase, trim, collapse internal whitespace (bank / merchant text). */
export const normalizeTransactionDescriptionForDedup = (title: string): string => {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
};

/** Stable calendar day for hashing (YYYY-MM-DD). */
export const transactionDateKeyForDedup = (transactionDate: string): string => {
  const t = transactionDate.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    return t.slice(0, 10);
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid transaction date.');
  }
  return d.toISOString().slice(0, 10);
};

/**
 * Per-user duplicate fingerprint: date + amount (cents) + normalized description.
 * SHA-256 hex, 64 chars.
 */
/** Outgoing uses the legacy fingerprint so existing rows keep stable dedup; incoming appends a suffix. */
export const computeTransactionDedupHash = (
  transactionDate: string,
  amount: number,
  title: string,
  flow: 'Outgoing' | 'Incoming' = 'Outgoing',
): string => {
  const dateKey = transactionDateKeyForDedup(transactionDate);
  const amountKey = roundToCents(amount).toFixed(2);
  const desc = normalizeTransactionDescriptionForDedup(title);
  let payload = `${dateKey}|${amountKey}|${desc}`;
  if (flow === 'Incoming') {
    payload = `${payload}|incoming`;
  }
  return createHash('sha256').update(payload, 'utf8').digest('hex');
};

export const DUPLICATE_TRANSACTION_MESSAGE =
  'Duplicate transaction: the same date, amount, and description already exists for your account.';
