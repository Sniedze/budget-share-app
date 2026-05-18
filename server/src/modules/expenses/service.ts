import type {
  CreateExpenseInput,
  Expense,
  ExpenseFlow,
  ImportExpenseRowInput,
  ImportExpenseRowResult,
  ImportExpensesResult,
  SplitAllocation,
  SplitType,
  UpdateExpenseInput,
} from './types.js';
import { AppError } from '../../graphql/appError.js';
import { db } from '../../db/mysql.js';
import { DEFAULT_CURRENCY, normalizeExpenseCurrency } from '../../lib/currency.js';
import { toIsoString } from '../../lib/dates.js';
import { logAuditEvent } from '../audit/service.js';
import { appError, ErrorCode } from '../../graphql/appError.js';
import { logAuthzDenied } from '../../logger.js';
import {
  DUPLICATE_TRANSACTION_MESSAGE,
  computeTransactionDedupHash,
  transactionDedupFieldsUnchanged,
} from './transactionDedup.js';
import { EXPENSE_SELECT_COLUMNS, mapExpenseRow, rowCurrencyFromRow, type ExpenseRow } from './mapExpenseRow.js';
import { parseSplitDetails } from './parseSplitDetails.js';
import { toStoredSplitDetails } from './splitAllocation.js';
import {
  legacyPrivateExpenseHiddenFromOthers,
  loadExpenseViewerProfile,
  viewerParticipatesInCustomSplit,
  expenseGroupTemplateLookupKey,
  viewerParticipatesInExpenseGroup,
  type ExpenseViewerProfile,
} from '../groups/expenseVisibility.js';
import {
  groupMemberMatchesViewerClause,
  groupMemberMatchesViewerParams,
  loadViewerGroupMemberName,
  type GroupViewer,
} from '../groups/memberIdentity.js';
import { listTemplateSplitDetailsByGroupAndCategory } from '../groups/service.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

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

const normalizeExpenseFlow = (raw: string | null | undefined): ExpenseFlow => {
  if (raw === 'Incoming') {
    return 'Incoming';
  }
  return 'Outgoing';
};

const validateAmount = (amount: number): void => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Expense amount must be greater than zero.');
  }
};

const TITLE_MAX_LENGTH = 255;

const validateExpenseTitle = (title: string): string => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Expense title is required.');
  }
  if (trimmed.length > TITLE_MAX_LENGTH) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Expense title is too long.');
  }
  return trimmed;
};

const validateSplitConsistency = (
  split: string,
  splitDetails: SplitAllocation[] | null,
  isCreate: boolean,
): void => {
  if (split === 'Custom' && isCreate && (!splitDetails || splitDetails.length === 0)) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Custom split requires splitDetails.');
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

const loadMemberGroupIds = async (actor: { userId: string; email: string }): Promise<Set<number>> => {
  const [rows] = await db.query<RowDataPacket[]>(
    `SELECT group_id FROM group_members WHERE ${groupMemberMatchesViewerClause()}`,
    groupMemberMatchesViewerParams(actor),
  );
  return new Set(rows.map((row) => Number(row.group_id)));
};

const assertGroupMember = (groupId: number, memberGroupIds: Set<number>): void => {
  if (!memberGroupIds.has(groupId)) {
    throw appError(ErrorCode.FORBIDDEN, 'You are not a member of this group.');
  }
};

const MAX_IMPORT_EXPENSE_ROWS = 1000;

type TemplateSplitSource = Array<{ participant: string; ratio: number }>;

type CreateExpenseBatchContext = {
  memberGroupIds: Set<number>;
  templateCache: Map<string, TemplateSplitSource | undefined>;
};

const templateCacheKey = (groupId: number, category: string, expenseGroup: string | null): string =>
  `${groupId}:${expenseGroup ?? category}`;

const loadTemplateSplitSource = async (
  groupId: number,
  category: string,
  expenseGroup: string | null,
  cache: Map<string, TemplateSplitSource | undefined>,
): Promise<TemplateSplitSource | undefined> => {
  const key = templateCacheKey(groupId, category, expenseGroup);
  if (cache.has(key)) {
    return cache.get(key);
  }

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
  let parsed: TemplateSplitSource | undefined;
  if (templateRow?.split_details) {
    try {
      const raw = JSON.parse(templateRow.split_details) as Array<{ participant: string; ratio: number }>;
      if (Array.isArray(raw) && raw.length > 0) {
        parsed = raw;
      }
    } catch {
      parsed = undefined;
    }
  }
  cache.set(key, parsed);
  return parsed;
};

const createExpenseWithContext = async (
  input: CreateExpenseInput,
  actor: { userId: string; email: string },
  batch: CreateExpenseBatchContext,
): Promise<Expense> => {
  validateAmount(input.amount);
  const title = validateExpenseTitle(input.title);
  const flow = normalizeExpenseFlow(input.flow);
  if (flow === 'Incoming' && input.groupId) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Income entries cannot be assigned to a household.');
  }

  const category = normalizeCategory(input.category);
  let expenseGroup = flow === 'Incoming' ? null : normalizeExpenseGroup(input.expenseGroup);
  let split: SplitType = flow === 'Incoming' ? 'Personal' : normalizeSplit(input.split);
  let groupId = flow === 'Incoming' ? null : input.groupId ? Number(input.groupId) : null;
  let sourceSplitDetails = flow === 'Incoming' ? undefined : input.splitDetails;
  if (groupId !== null && !expenseGroup) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Expense group is required for household expenses.');
  }

  if (groupId !== null && sourceSplitDetails === undefined) {
    const templateSplit = await loadTemplateSplitSource(
      groupId,
      category,
      expenseGroup,
      batch.templateCache,
    );
    if (templateSplit) {
      sourceSplitDetails = templateSplit;
      split = 'Custom';
    }
  }

  const splitDetails = toStoredSplitDetails(input.amount, sourceSplitDetails);
  validateSplitConsistency(split, splitDetails, true);
  const splitDetailsJson = splitDetails.length > 0 ? JSON.stringify(splitDetails) : null;
  if (groupId !== null) {
    assertGroupMember(groupId, batch.memberGroupIds);
  }
  const paidByUserId = input.paidByUserId ? Number(input.paidByUserId) : Number(actor.userId);
  const isPrivate = false;
  const currency = normalizeExpenseCurrency(input.currency);
  const transactionDedupHash = computeTransactionDedupHash(
    input.transactionDate,
    input.amount,
    title,
    flow,
  );

  let result: ResultSetHeader;
  try {
    [result] = await db.execute<ResultSetHeader>(
      'INSERT INTO expenses (title, amount, transaction_date, category, expense_group, split_type, split_details, group_id, created_by_user_id, paid_by_user_id, transaction_dedup_hash, is_private, currency, expense_flow) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title,
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
        currency,
        flow,
      ],
    );
  } catch (error) {
    if (isMysqlDuplicateKeyError(error)) {
      throw appError(ErrorCode.DUPLICATE_TRANSACTION, DUPLICATE_TRANSACTION_MESSAGE);
    }
    throw error;
  }

  const fallback: Expense = {
    id: String(result.insertId),
    title,
    amount: input.amount,
    currency,
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
    flow,
  };

  const [rows] = await db.query<ExpenseRow[]>(
    `SELECT ${EXPENSE_SELECT_COLUMNS} FROM expenses WHERE id = ? LIMIT 1`,
    [result.insertId],
  );

  return mapExpenseRow(rows[0], fallback);
};

const canAccessExpense = (
  row: ExpenseRow,
  viewer: ExpenseViewerProfile,
  memberGroupIds: Set<number>,
): boolean => {
  if (row.group_id === null) {
    if (row.created_by_user_id !== null && String(row.created_by_user_id) === viewer.userId) {
      return true;
    }
    if (normalizeSplit(row.split_type) === 'Custom') {
      return viewerParticipatesInCustomSplit(
        typeof row.split_details === 'string' ? row.split_details : null,
        Number(row.amount),
        viewer,
        row.created_by_user_id,
      );
    }
    return false;
  }
  return memberGroupIds.has(row.group_id);
};

export const listExpenses = async (userId: string, userEmail: string): Promise<Expense[]> => {
  const viewerProfile = await loadExpenseViewerProfile(userId, userEmail);
  const viewer: GroupViewer = { userId, email: userEmail };
  const memberGroupIds = await loadMemberGroupIds({ userId, email: userEmail });
  const templateSplitByKey = await listTemplateSplitDetailsByGroupAndCategory([...memberGroupIds]);
  const viewerNameByGroupId = new Map<number, string | null>();
  for (const groupId of memberGroupIds) {
    viewerNameByGroupId.set(groupId, await loadViewerGroupMemberName(groupId, viewer));
  }
  const [rows] = await db.query<ExpenseRow[]>(
    `SELECT ${EXPENSE_SELECT_COLUMNS} FROM expenses ORDER BY transaction_date DESC, id DESC`,
  );

  const visible: Expense[] = [];
  for (const row of rows) {
    // Hide legacy rows until ownership/group assignment exists.
    if (row.created_by_user_id === null && row.group_id === null) {
      continue;
    }
    if (!canAccessExpense(row, viewerProfile, memberGroupIds)) {
      continue;
    }
    if (row.group_id !== null) {
      if (legacyPrivateExpenseHiddenFromOthers(rowIsPrivate(row), row.created_by_user_id, userId)) {
        continue;
      }
      const templateSplit =
        templateSplitByKey.get(
          expenseGroupTemplateLookupKey(row.group_id, row.expense_group, row.category),
        ) ?? [];
      if (
        !viewerParticipatesInExpenseGroup(
          viewerNameByGroupId.get(row.group_id) ?? null,
          row.split_type,
          typeof row.split_details === 'string' ? row.split_details : null,
          templateSplit,
          Number(row.amount),
        )
      ) {
        continue;
      }
    }
    visible.push(
      mapExpenseRow(row, {
        id: String(row.id),
        title: row.title,
        amount: Number(row.amount),
        currency: rowCurrencyFromRow(row),
        createdAt: toIsoString(row.created_at),
        transactionDate: toIsoString(row.transaction_date),
        category: row.category,
        split: normalizeSplit(row.split_type),
        splitDetails: [],
        isPrivate: rowIsPrivate(row),
        flow: normalizeExpenseFlow(row.expense_flow),
      }),
    );
  }
  return visible;
};

export const createExpense = async (
  input: CreateExpenseInput,
  actor: { userId: string; email: string },
): Promise<Expense> => {
  const memberGroupIds = await loadMemberGroupIds(actor);
  return createExpenseWithContext(input, actor, {
    memberGroupIds,
    templateCache: new Map(),
  });
};

const toImportRowError = (error: unknown): Pick<ImportExpenseRowResult, 'errorCode' | 'errorMessage'> => {
  if (error instanceof AppError) {
    const code = error.extensions?.code;
    return {
      errorCode: typeof code === 'string' ? code : ErrorCode.INTERNAL_SERVER_ERROR,
      errorMessage: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
      errorMessage: error.message,
    };
  }
  return {
    errorCode: ErrorCode.INTERNAL_SERVER_ERROR,
    errorMessage: 'Import failed.',
  };
};

export const importExpenses = async (
  rows: ImportExpenseRowInput[],
  actor: { userId: string; email: string },
): Promise<ImportExpensesResult> => {
  if (rows.length === 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'At least one expense row is required.');
  }
  if (rows.length > MAX_IMPORT_EXPENSE_ROWS) {
    throw appError(
      ErrorCode.BAD_USER_INPUT,
      `Cannot import more than ${MAX_IMPORT_EXPENSE_ROWS} expenses at once.`,
    );
  }

  const batch: CreateExpenseBatchContext = {
    memberGroupIds: await loadMemberGroupIds(actor),
    templateCache: new Map(),
  };

  const results: ImportExpenseRowResult[] = [];
  for (const row of rows) {
    const { clientRowId, ...input } = row;
    const trimmedId = clientRowId.trim();
    if (trimmedId.length === 0) {
      results.push({
        clientRowId,
        success: false,
        ...toImportRowError(appError(ErrorCode.BAD_USER_INPUT, 'clientRowId is required.')),
      });
      continue;
    }
    try {
      const expense = await createExpenseWithContext(input, actor, batch);
      results.push({ clientRowId: trimmedId, success: true, expense });
    } catch (error) {
      results.push({
        clientRowId: trimmedId,
        success: false,
        ...toImportRowError(error),
      });
    }
  }

  const importedCount = results.filter((entry) => entry.success).length;
  return {
    results,
    importedCount,
    failedCount: results.length - importedCount,
  };
};

export const deleteExpense = async (id: string, actor: { userId: string; email: string }): Promise<boolean> => {
  const [rows] = await db.query<ExpenseRow[]>(
    `SELECT ${EXPENSE_SELECT_COLUMNS} FROM expenses WHERE id = ? LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) {
    return false;
  }

  if (row.group_id === null) {
    if (row.created_by_user_id === null || String(row.created_by_user_id) !== actor.userId) {
      logAuthzDenied('expense_delete_denied', { expenseId: id, userId: actor.userId, reason: 'personal_owner' });
      throw appError(ErrorCode.FORBIDDEN, 'Not authorized to delete this expense.');
    }
  } else {
    const memberGroupIds = await loadMemberGroupIds(actor);
    if (!memberGroupIds.has(row.group_id)) {
      logAuthzDenied('expense_delete_denied', { expenseId: id, userId: actor.userId, reason: 'not_group_member' });
      throw appError(ErrorCode.FORBIDDEN, 'Not authorized to delete this expense.');
    }
    if (rowIsPrivate(row) && String(row.created_by_user_id) !== actor.userId) {
      logAuthzDenied('expense_delete_denied', { expenseId: id, userId: actor.userId, reason: 'private_not_owner' });
      throw appError(ErrorCode.FORBIDDEN, 'Not authorized to delete this private expense.');
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
        currency: rowCurrencyFromRow(row),
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
  const title = validateExpenseTitle(input.title);

  const [existingRows] = await db.query<ExpenseRow[]>(
    `SELECT ${EXPENSE_SELECT_COLUMNS} FROM expenses WHERE id = ? LIMIT 1`,
    [input.id],
  );
  const existing = existingRows[0];
  if (!existing) {
    return null;
  }

  const memberGroupIds = await loadMemberGroupIds(actor);
  const existingGroupId = existing.group_id;
  const canEdit =
    existingGroupId === null
      ? existing.created_by_user_id !== null && String(existing.created_by_user_id) === actor.userId
      : memberGroupIds.has(existingGroupId);
  if (!canEdit) {
    logAuthzDenied('expense_update_denied', { expenseId: input.id, userId: actor.userId, reason: 'no_edit_access' });
    throw appError(ErrorCode.FORBIDDEN, 'Not authorized to update this expense.');
  }
  if (
    existingGroupId !== null &&
    rowIsPrivate(existing) &&
    String(existing.created_by_user_id) !== actor.userId
  ) {
    logAuthzDenied('expense_update_denied', { expenseId: input.id, userId: actor.userId, reason: 'private_not_owner' });
    throw appError(ErrorCode.FORBIDDEN, 'Not authorized to update this private expense.');
  }

  const nextFlow = normalizeExpenseFlow(input.flow !== undefined ? input.flow : existing.expense_flow);
  if (nextFlow === 'Incoming' && input.groupId) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Income entries cannot be assigned to a household.');
  }

  const category = normalizeCategory(input.category);
  let expenseGroup: string | null;
  let split: SplitType;
  let splitDetailsJson: string | null;
  let nextGroupId: number | null;

  if (nextFlow === 'Incoming') {
    expenseGroup = null;
    split = 'Personal';
    nextGroupId = null;
    const splitDetails = toStoredSplitDetails(input.amount, undefined);
    validateSplitConsistency(split, splitDetails, false);
    splitDetailsJson = splitDetails.length > 0 ? JSON.stringify(splitDetails) : null;
  } else {
    expenseGroup = normalizeExpenseGroup(input.expenseGroup);
    split = normalizeSplit(input.split);
    nextGroupId = input.groupId ? Number(input.groupId) : existingGroupId;
    if (nextGroupId !== null && !expenseGroup) {
      throw appError(ErrorCode.BAD_USER_INPUT, 'Expense group is required for household expenses.');
    }
    if (input.splitDetails === undefined) {
      validateSplitConsistency(split, parseSplitDetails(existing.split_details), false);
      splitDetailsJson = null;
    } else {
      const splitDetails = toStoredSplitDetails(input.amount, input.splitDetails);
      validateSplitConsistency(split, splitDetails, false);
      splitDetailsJson = JSON.stringify(splitDetails);
    }
  }

  if (nextGroupId !== null) {
    assertGroupMember(nextGroupId, memberGroupIds);
  }
  const nextPaidByUserId = input.paidByUserId ? Number(input.paidByUserId) : existing.paid_by_user_id;
  const nextIsPrivate = false;
  const existingFlow = normalizeExpenseFlow(existing.expense_flow);
  const nextDedupHash =
    existing.created_by_user_id === null
      ? null
      : transactionDedupFieldsUnchanged({
          existingTransactionDate: toIsoString(existing.transaction_date),
          existingAmount: existing.amount,
          existingTitle: existing.title,
          existingFlow,
          nextTransactionDate: input.transactionDate,
          nextAmount: input.amount,
          nextTitle: title,
          nextFlow,
        })
        ? existing.transaction_dedup_hash
        : computeTransactionDedupHash(input.transactionDate, input.amount, title, nextFlow);
  const nextCurrency = normalizeExpenseCurrency(
    input.currency !== undefined && input.currency !== null ? input.currency : rowCurrencyFromRow(existing),
  );

  let updateResult: ResultSetHeader;
  try {
    [updateResult] = await db.execute<ResultSetHeader>(
      'UPDATE expenses SET title = ?, amount = ?, transaction_date = ?, category = ?, expense_group = ?, split_type = ?, split_details = COALESCE(?, split_details), group_id = ?, paid_by_user_id = ?, transaction_dedup_hash = ?, is_private = ?, currency = ?, expense_flow = ? WHERE id = ?',
      [
        title,
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
        nextCurrency,
        nextFlow,
        input.id,
      ],
    );
  } catch (error) {
    if (isMysqlDuplicateKeyError(error)) {
      throw appError(ErrorCode.DUPLICATE_TRANSACTION, DUPLICATE_TRANSACTION_MESSAGE);
    }
    throw error;
  }

  if (updateResult.affectedRows === 0) {
    return null;
  }

  const [rows] = await db.query<ExpenseRow[]>(
    `SELECT ${EXPENSE_SELECT_COLUMNS} FROM expenses WHERE id = ? LIMIT 1`,
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
      currency: rowCurrencyFromRow(existing),
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
      currency: rowCurrencyFromRow(row),
      isPrivate: rowIsPrivate(row),
    },
  });

  return mapExpenseRow(row, {
    id: String(existing.id),
    title: existing.title,
    amount: Number(existing.amount),
    currency: rowCurrencyFromRow(existing),
    createdAt: toIsoString(existing.created_at),
    transactionDate: toIsoString(existing.transaction_date),
    category: existing.category,
    expenseGroup: existing.expense_group ?? undefined,
    split: normalizeSplit(existing.split_type),
    splitDetails: parseSplitDetails(existing.split_details),
    groupId: existing.group_id === null ? undefined : String(existing.group_id),
    createdByUserId:
      existing.created_by_user_id === null ? undefined : String(existing.created_by_user_id),
    paidByUserId: existing.paid_by_user_id === null ? undefined : String(existing.paid_by_user_id),
    isPrivate: rowIsPrivate(existing),
    flow: normalizeExpenseFlow(existing.expense_flow),
  });
};
