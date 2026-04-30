import type {
  CreateExpenseInput,
  Expense,
  SplitAllocation,
  SplitType,
  UpdateExpenseInput,
} from './types.js';
import { db } from '../../db/mysql.js';
import { logAuditEvent } from '../audit/service.js';
import {
  DUPLICATE_TRANSACTION_MESSAGE,
  computeTransactionDedupHash,
} from './transactionDedup.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

type ExpenseRow = {
  id: number;
  title: string;
  amount: string;
  created_at: Date | string;
  transaction_date: Date | string;
  category: string;
  expense_group: string | null;
  split_type: string;
  split_details: string | SplitAllocation[] | null;
  group_id: number | null;
  created_by_user_id: number | null;
  paid_by_user_id: number | null;
  transaction_dedup_hash: string | null;
  is_private?: number;
} & RowDataPacket;

const rowIsPrivate = (row: { is_private?: number | boolean | null }): boolean => {
  const v = row.is_private;
  return v === true || v === 1;
};

type TemplateRow = {
  split_details: string;
} & RowDataPacket;

const DEFAULT_CATEGORY = 'General';
const DEFAULT_SPLIT = 'Personal';
const ALLOWED_SPLITS = new Set(['Personal', 'Shared', 'Custom']);

const toIsoString = (value: Date | string): string => {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const normalizeCategory = (category: string): string => {
  const trimmed = category.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_CATEGORY;
};

const normalizeExpenseGroup = (expenseGroup?: string): string | null => {
  if (typeof expenseGroup !== 'string') {
    return null;
  }
  const trimmed = expenseGroup.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSplit = (split: string): SplitType => {
  if (ALLOWED_SPLITS.has(split)) {
    return split as SplitType;
  }

  return DEFAULT_SPLIT;
};

const roundToCents = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const toStoredSplitDetails = (
  amount: number,
  splitDetails: CreateExpenseInput['splitDetails'],
): SplitAllocation[] => {
  if (!splitDetails || splitDetails.length === 0) {
    return [];
  }

  const normalized = splitDetails
    .map((entry) => ({
      participant: entry.participant.trim(),
      ratio: Number(entry.ratio),
    }))
    .filter((entry) => entry.participant.length > 0 && Number.isFinite(entry.ratio) && entry.ratio > 0);

  if (normalized.length === 0) {
    return [];
  }

  const ratioTotal = normalized.reduce((sum, entry) => sum + entry.ratio, 0);
  if (Math.abs(ratioTotal - 100) > 0.01) {
    throw new Error('Split ratios must sum to 100.');
  }

  let allocated = 0;
  return normalized.map((entry, index) => {
    const isLast = index === normalized.length - 1;
    const rawAmount = (amount * entry.ratio) / 100;
    const shareAmount = isLast ? roundToCents(amount - allocated) : roundToCents(rawAmount);
    allocated = roundToCents(allocated + shareAmount);

    return {
      participant: entry.participant,
      ratio: roundToCents(entry.ratio),
      amount: shareAmount,
    };
  });
};

const validateAmount = (amount: number): void => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }
};

const validateSplitConsistency = (
  split: string,
  splitDetails: SplitAllocation[] | null,
  isCreate: boolean,
): void => {
  if (split === 'Custom' && isCreate && (!splitDetails || splitDetails.length === 0)) {
    throw new Error('Custom split requires splitDetails.');
  }
};

const parseSplitDetails = (rawValue: string | SplitAllocation[] | null): SplitAllocation[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = typeof rawValue === 'string' ? (JSON.parse(rawValue) as unknown) : rawValue;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => {
        const participant =
          typeof entry === 'object' &&
          entry !== null &&
          'participant' in entry &&
          typeof entry.participant === 'string'
            ? entry.participant
            : '';
        const ratio =
          typeof entry === 'object' && entry !== null && 'ratio' in entry && Number.isFinite(entry.ratio)
            ? Number(entry.ratio)
            : NaN;
        const amount =
          typeof entry === 'object' && entry !== null && 'amount' in entry && Number.isFinite(entry.amount)
            ? Number(entry.amount)
            : NaN;

        return { participant, ratio, amount };
      })
      .filter(
        (entry) => entry.participant.length > 0 && Number.isFinite(entry.ratio) && Number.isFinite(entry.amount),
      );
  } catch {
    return [];
  }
};

const isMysqlDuplicateKeyError = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
};

const isGroupMember = async (groupId: number, userEmail: string): Promise<boolean> => {
  const [rows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ?
        AND (email = ?)
      LIMIT 1
    `,
    [groupId, userEmail],
  );
  return rows.length > 0;
};

const canAccessExpense = async (row: ExpenseRow, userId: string, userEmail: string): Promise<boolean> => {
  if (row.group_id === null) {
    return row.created_by_user_id !== null && String(row.created_by_user_id) === userId;
  }
  return isGroupMember(row.group_id, userEmail);
};

export const listExpenses = async (userId: string, userEmail: string): Promise<Expense[]> => {
  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at, transaction_date, category, expense_group, split_type, split_details, group_id, created_by_user_id, paid_by_user_id, transaction_dedup_hash, is_private FROM expenses ORDER BY transaction_date DESC, id DESC',
  );

  const visible: Expense[] = [];
  for (const row of rows) {
    // Hide legacy rows until ownership/group assignment exists.
    if (row.created_by_user_id === null && row.group_id === null) {
      continue;
    }
    if (!(await canAccessExpense(row, userId, userEmail))) {
      continue;
    }
    if (row.group_id !== null && rowIsPrivate(row) && String(row.created_by_user_id) !== userId) {
      continue;
    }
    visible.push({
      id: String(row.id),
      title: row.title,
      amount: Number(row.amount),
      createdAt: toIsoString(row.created_at),
      transactionDate: toIsoString(row.transaction_date),
      category: row.category,
      expenseGroup: row.expense_group ?? undefined,
      split: normalizeSplit(row.split_type),
      splitDetails: parseSplitDetails(row.split_details),
      groupId: row.group_id === null ? undefined : String(row.group_id),
      createdByUserId: row.created_by_user_id === null ? undefined : String(row.created_by_user_id),
      paidByUserId: row.paid_by_user_id === null ? undefined : String(row.paid_by_user_id),
      isPrivate: rowIsPrivate(row),
    });
  }
  return visible;
};

export const createExpense = async (
  input: CreateExpenseInput,
  actor: { userId: string; email: string },
): Promise<Expense> => {
  validateAmount(input.amount);
  const category = normalizeCategory(input.category);
  const expenseGroup = normalizeExpenseGroup(input.expenseGroup);
  let split = normalizeSplit(input.split);
  const groupId = input.groupId ? Number(input.groupId) : null;
  let sourceSplitDetails = input.splitDetails;
  if (groupId !== null && !expenseGroup) {
    throw new Error('Expense group is required for household expenses.');
  }

  if (groupId !== null && sourceSplitDetails === undefined) {
    const [templateRows] = await db.query<TemplateRow[]>(
      `
        SELECT split_details
        FROM group_split_templates
        WHERE group_id = ? AND category = ?
        LIMIT 1
      `,
      [groupId, expenseGroup ?? category],
    );
    const templateRow = templateRows[0];
    if (templateRow?.split_details) {
      try {
        const parsed = JSON.parse(templateRow.split_details) as Array<{ participant: string; ratio: number }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          sourceSplitDetails = parsed;
          split = 'Custom';
        }
      } catch {
        // Ignore invalid template payload and continue with direct input.
      }
    }
  }

  const splitDetails = toStoredSplitDetails(input.amount, sourceSplitDetails);
  validateSplitConsistency(split, splitDetails, true);
  const splitDetailsJson = splitDetails.length > 0 ? JSON.stringify(splitDetails) : null;
  if (groupId !== null && !(await isGroupMember(groupId, actor.email))) {
    throw new Error('You are not a member of this group.');
  }
  const paidByUserId = input.paidByUserId ? Number(input.paidByUserId) : Number(actor.userId);
  const isPrivate = groupId !== null && Boolean(input.isPrivate);
  const transactionDedupHash = computeTransactionDedupHash(
    input.transactionDate,
    input.amount,
    input.title,
  );

  let result: ResultSetHeader;
  try {
    [result] = await db.execute<ResultSetHeader>(
      'INSERT INTO expenses (title, amount, transaction_date, category, expense_group, split_type, split_details, group_id, created_by_user_id, paid_by_user_id, transaction_dedup_hash, is_private) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.title,
        input.amount,
        input.transactionDate,
        category,
        expenseGroup,
        split,
        splitDetailsJson,
        groupId,
        Number(actor.userId),
        paidByUserId,
        transactionDedupHash,
        isPrivate ? 1 : 0,
      ],
    );
  } catch (error) {
    if (isMysqlDuplicateKeyError(error)) {
      throw new Error(DUPLICATE_TRANSACTION_MESSAGE);
    }
    throw error;
  }

  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at, transaction_date, category, expense_group, split_type, split_details, group_id, created_by_user_id, paid_by_user_id, transaction_dedup_hash, is_private FROM expenses WHERE id = ? LIMIT 1',
    [result.insertId],
  );

  const row = rows[0];

  if (!row) {
    return {
      id: String(result.insertId),
      title: input.title,
      amount: input.amount,
      createdAt: new Date().toISOString(),
      transactionDate: new Date(input.transactionDate).toISOString(),
      category,
      expenseGroup: expenseGroup ?? undefined,
      split,
      splitDetails,
      groupId: groupId === null ? undefined : String(groupId),
      createdByUserId: actor.userId,
      paidByUserId: String(paidByUserId),
      isPrivate,
    };
  }

  return {
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
    createdAt: toIsoString(row.created_at),
    transactionDate: toIsoString(row.transaction_date),
    category: row.category,
    expenseGroup: row.expense_group ?? undefined,
    split: normalizeSplit(row.split_type),
    splitDetails: parseSplitDetails(row.split_details),
    groupId: row.group_id === null ? undefined : String(row.group_id),
    createdByUserId: row.created_by_user_id === null ? undefined : String(row.created_by_user_id),
    paidByUserId: row.paid_by_user_id === null ? undefined : String(row.paid_by_user_id),
    isPrivate: rowIsPrivate(row),
  };
};

export const deleteExpense = async (id: string, actor: { userId: string; email: string }): Promise<boolean> => {
  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, group_id, created_by_user_id, paid_by_user_id, title, amount, created_at, transaction_date, category, expense_group, split_type, split_details, transaction_dedup_hash, is_private FROM expenses WHERE id = ? LIMIT 1',
    [id],
  );
  const row = rows[0];
  if (!row) {
    return false;
  }

  if (row.group_id === null) {
    if (row.created_by_user_id === null || String(row.created_by_user_id) !== actor.userId) {
      throw new Error('Not authorized to delete this expense.');
    }
  } else {
    if (!(await isGroupMember(row.group_id, actor.email))) {
      throw new Error('Not authorized to delete this expense.');
    }
    if (rowIsPrivate(row) && String(row.created_by_user_id) !== actor.userId) {
      throw new Error('Not authorized to delete this private expense.');
    }
  }

  const [result] = await db.execute<ResultSetHeader>('DELETE FROM expenses WHERE id = ?', [id]);
  if (result.affectedRows > 0) {
    await logAuditEvent({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      action: 'DELETE_EXPENSE',
      entityType: 'expense',
      entityId: String(row.id),
      beforeState: {
        id: row.id,
        title: row.title,
        amount: Number(row.amount),
        transactionDate: toIsoString(row.transaction_date),
        category: row.category,
        expenseGroup: row.expense_group,
        split: row.split_type,
        splitDetails: parseSplitDetails(row.split_details),
        groupId: row.group_id,
        createdByUserId: row.created_by_user_id,
        paidByUserId: row.paid_by_user_id,
        isPrivate: rowIsPrivate(row),
      },
      afterState: null,
    });
  }

  return result.affectedRows > 0;
};

export const updateExpense = async (
  input: UpdateExpenseInput,
  actor: { userId: string; email: string },
): Promise<Expense | null> => {
  validateAmount(input.amount);
  const category = normalizeCategory(input.category);
  const expenseGroup = normalizeExpenseGroup(input.expenseGroup);
  const split = normalizeSplit(input.split);
  const splitDetails =
    input.splitDetails === undefined ? null : toStoredSplitDetails(input.amount, input.splitDetails);
  validateSplitConsistency(split, splitDetails, false);
  const splitDetailsJson = splitDetails === null ? null : JSON.stringify(splitDetails);

  const [existingRows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at, transaction_date, category, expense_group, split_type, split_details, group_id, created_by_user_id, paid_by_user_id, transaction_dedup_hash, is_private FROM expenses WHERE id = ? LIMIT 1',
    [input.id],
  );
  const existing = existingRows[0];
  if (!existing) {
    return null;
  }

  const existingGroupId = existing.group_id;
  const canEdit =
    existingGroupId === null
      ? existing.created_by_user_id !== null && String(existing.created_by_user_id) === actor.userId
      : await isGroupMember(existingGroupId, actor.email);
  if (!canEdit) {
    throw new Error('Not authorized to update this expense.');
  }
  if (
    existingGroupId !== null &&
    rowIsPrivate(existing) &&
    String(existing.created_by_user_id) !== actor.userId
  ) {
    throw new Error('Not authorized to update this private expense.');
  }

  const nextGroupId = input.groupId ? Number(input.groupId) : existingGroupId;
  if (nextGroupId !== null && !expenseGroup) {
    throw new Error('Expense group is required for household expenses.');
  }
  if (nextGroupId !== null && !(await isGroupMember(nextGroupId, actor.email))) {
    throw new Error('You are not a member of this group.');
  }
  const nextPaidByUserId = input.paidByUserId ? Number(input.paidByUserId) : existing.paid_by_user_id;
  const nextIsPrivate =
    nextGroupId === null ? false : input.isPrivate !== undefined ? Boolean(input.isPrivate) : rowIsPrivate(existing);
  const nextDedupHash =
    existing.created_by_user_id === null
      ? null
      : computeTransactionDedupHash(input.transactionDate, input.amount, input.title);

  let updateResult: ResultSetHeader;
  try {
    [updateResult] = await db.execute<ResultSetHeader>(
      'UPDATE expenses SET title = ?, amount = ?, transaction_date = ?, category = ?, expense_group = ?, split_type = ?, split_details = COALESCE(?, split_details), group_id = ?, paid_by_user_id = ?, transaction_dedup_hash = ?, is_private = ? WHERE id = ?',
      [
        input.title,
        input.amount,
        input.transactionDate,
        category,
        expenseGroup,
        split,
        splitDetailsJson,
        nextGroupId,
        nextPaidByUserId,
        nextDedupHash,
        nextIsPrivate ? 1 : 0,
        input.id,
      ],
    );
  } catch (error) {
    if (isMysqlDuplicateKeyError(error)) {
      throw new Error(DUPLICATE_TRANSACTION_MESSAGE);
    }
    throw error;
  }

  if (updateResult.affectedRows === 0) {
    return null;
  }

  const [rows] = await db.query<ExpenseRow[]>(
    'SELECT id, title, amount, created_at, transaction_date, category, expense_group, split_type, split_details, group_id, created_by_user_id, paid_by_user_id, transaction_dedup_hash, is_private FROM expenses WHERE id = ? LIMIT 1',
    [input.id],
  );

  const row = rows[0];

  if (!row) {
    return null;
  }

  await logAuditEvent({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'UPDATE_EXPENSE',
    entityType: 'expense',
    entityId: String(row.id),
    beforeState: {
      id: existing.id,
      title: existing.title,
      amount: Number(existing.amount),
      transactionDate: toIsoString(existing.transaction_date),
      category: existing.category,
      expenseGroup: existing.expense_group,
      split: existing.split_type,
      splitDetails: parseSplitDetails(existing.split_details),
      groupId: existing.group_id,
      createdByUserId: existing.created_by_user_id,
      paidByUserId: existing.paid_by_user_id,
      isPrivate: rowIsPrivate(existing),
    },
    afterState: {
      id: row.id,
      title: row.title,
      amount: Number(row.amount),
      transactionDate: toIsoString(row.transaction_date),
      category: row.category,
      expenseGroup: row.expense_group,
      split: row.split_type,
      splitDetails: parseSplitDetails(row.split_details),
      groupId: row.group_id,
      createdByUserId: row.created_by_user_id,
      paidByUserId: row.paid_by_user_id,
      isPrivate: rowIsPrivate(row),
    },
  });

  return {
    id: String(row.id),
    title: row.title,
    amount: Number(row.amount),
    createdAt: toIsoString(row.created_at),
    transactionDate: toIsoString(row.transaction_date),
    category: row.category,
    expenseGroup: row.expense_group ?? undefined,
    split: normalizeSplit(row.split_type),
    splitDetails: parseSplitDetails(row.split_details),
    groupId: row.group_id === null ? undefined : String(row.group_id),
    createdByUserId: row.created_by_user_id === null ? undefined : String(row.created_by_user_id),
    paidByUserId: row.paid_by_user_id === null ? undefined : String(row.paid_by_user_id),
    isPrivate: rowIsPrivate(row),
  };
};
