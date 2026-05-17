import type { RowDataPacket } from 'mysql2';
import { DEFAULT_CURRENCY, normalizeExpenseCurrency } from '../../lib/currency.js';
import { toIsoString } from '../../lib/dates.js';
import type { Expense, ExpenseFlow, SplitType } from './types.js';
import { EXPENSE_SELECT_COLUMNS } from '../../db/sqlColumns.js';
import { parseSplitDetails } from './parseSplitDetails.js';

export { EXPENSE_SELECT_COLUMNS };

export type ExpenseRow = {
  id: number;
  title: string;
  amount: string;
  currency?: string | null;
  created_at: Date | string;
  transaction_date: Date | string;
  category: string;
  expense_group: string | null;
  split_type: string;
  split_details: string | import('./types.js').SplitAllocation[] | null;
  group_id: number | null;
  created_by_user_id: number | null;
  paid_by_user_id: number | null;
  transaction_dedup_hash: string | null;
  is_private?: number;
  expense_flow?: string | null;
} & RowDataPacket;

const DEFAULT_SPLIT = 'Personal';
const ALLOWED_SPLITS = new Set(['Personal', 'Shared', 'Custom']);

export const rowCurrencyFromRow = (row: { currency?: string | null }): string => {
  const c = row.currency;
  if (typeof c === 'string' && c.trim().length > 0) {
    return normalizeExpenseCurrency(c);
  }
  return DEFAULT_CURRENCY;
};

const normalizeSplit = (split: string): SplitType => {
  if (ALLOWED_SPLITS.has(split)) {
    return split as SplitType;
  }
  return DEFAULT_SPLIT;
};

const normalizeExpenseFlow = (raw: string | null | undefined): ExpenseFlow => {
  if (raw === 'Incoming') {
    return 'Incoming';
  }
  return 'Outgoing';
};

export const mapExpenseRow = (row: ExpenseRow | undefined, fallback: Expense): Expense => {
  if (!row) {
    return fallback;
  }
  return {
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
    currency: rowCurrencyFromRow(row),
    createdAt: toIsoString(row.created_at),
    transactionDate: toIsoString(row.transaction_date),
    category: row.category,
    expenseGroup: row.expense_group ?? undefined,
    split: normalizeSplit(row.split_type),
    splitDetails: parseSplitDetails(row.split_details),
    groupId: row.group_id === null ? undefined : String(row.group_id),
    createdByUserId: row.created_by_user_id === null ? undefined : String(row.created_by_user_id),
    paidByUserId: row.paid_by_user_id === null ? undefined : String(row.paid_by_user_id),
    isPrivate: row.group_id === null && normalizeSplit(row.split_type) === 'Personal',
    flow: normalizeExpenseFlow(row.expense_flow),
  };
};
