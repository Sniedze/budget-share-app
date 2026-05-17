import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import type {
  CreateGroupInput,
  CurrencySettlementScope,
  ExpenseGroupSettlement,
  Group,
  GroupInvitation,
  GroupMember,
  GroupPendingInvitation,
  InvitationEmailDeliveryStatus,
  HouseholdSettlement,
  RecordSettlementPaymentInput,
  SettlementBalance,
  SettlementPayment,
  SettlementTransfer,
  SplitTemplate,
  UpdateGroupInput,
  UpsertSplitTemplateInput,
} from './types.js';
import { normalizeExpenseCurrency } from '../../lib/currency.js';
import { appError, ErrorCode } from '../../graphql/appError.js';
import { logAuditEvent } from '../audit/service.js';
import { logAuthzDenied } from '../../logger.js';
import { toIsoString } from '../../lib/dates.js';
import { roundCents } from '../../lib/money.js';
import { stripControlCharacters } from '../../lib/sanitize.js';
import { queueExpenseGroupAddedEmails, queueHouseholdMemberInviteEmails } from '../email/sendMemberNotifications.js';
import {
  assertActiveGroupMembership,
  deleteInvitationsNotInEmails,
  mapInvitationStatus,
  upsertPendingInvitations,
} from './invitations.js';
import {
  type GroupViewer,
  findViewerGroupMember,
  groupMemberMatchesViewerClause,
  groupMemberMatchesViewerParams,
  loadUserIdsByEmails,
  normalizeMemberEmail,
  parseViewerUserId,
} from './memberIdentity.js';
import { buildOptimizedTransfers } from './settlementTransfers.js';
import { parseSettlementPeriod, settlementPeriodRange } from './settlementPeriod.js';

type GroupRow = {
  id: number;
  name: string;
  description: string | null;
} & RowDataPacket;

type GroupMemberRow = {
  groupId: number;
  name: string;
  email: string;
  ratio: number | string;
  userId: number | null;
} & RowDataPacket;

const mapGroupMemberRow = (row: GroupMemberRow): GroupMember => ({
  userId: row.userId !== null && row.userId !== undefined ? String(row.userId) : undefined,
  name: row.name,
  email: row.email,
  ratio: toNumericRatio(row.ratio),
});

type GroupInvitationRow = {
  id: number;
  groupId: number;
  groupName: string;
  email: string;
  status: string;
  emailDeliveryStatus: string | null;
  invitedAt: Date | string;
  acceptedAt: Date | string | null;
} & RowDataPacket;

const mapInvitationEmailDeliveryStatus = (
  raw: string | null | undefined,
): InvitationEmailDeliveryStatus | undefined => {
  switch (raw) {
    case 'pending_email':
      return 'PendingEmail';
    case 'email_sent':
      return 'EmailSent';
    case 'email_failed':
      return 'EmailFailed';
    case 'email_skipped':
      return 'EmailSkipped';
    default:
      return undefined;
  }
};

type GroupExpenseRow = {
  id: number;
  groupId: number;
  title: string;
  expenseGroup: string | null;
  category: string;
  amount: string;
  currency: string | null;
  splitType: string | null;
  transactionDate: Date | string;
  paidByName: string | null;
  isPrivate: number;
  createdByUserId: number | null;
} & RowDataPacket;

type SplitTemplateRow = {
  id: number;
  groupId: number;
  category: string;
  templateName: string;
  splitDetails: string | Array<{ participant: string; ratio: number }>;
} & RowDataPacket;

type SettlementExpenseRow = {
  id: number;
  groupId: number;
  amount: string;
  currency: string | null;
  expenseGroup: string | null;
  category: string | null;
  splitType: string | null;
  splitDetails: string | null;
  paidByName: string | null;
} & RowDataPacket;

type SettlementPaymentRow = {
  id: number;
  groupId: number;
  expenseGroup: string | null;
  fromMember: string;
  toMember: string;
  amount: string;
  note: string | null;
  settledAt: Date | string;
} & RowDataPacket;

const toNumericRatio = (value: number | string): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeMembers = (members: GroupMember[]): GroupMember[] => {
  return members.map((member) => ({
    name: member.name.trim(),
    email: member.email.trim().toLowerCase(),
    ratio: Number(member.ratio.toFixed(2)),
  }));
};

const isMissingTableError = (error: unknown, tableName: string): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = 'code' in error ? String(error.code) : '';
  const message = 'message' in error ? String(error.message) : '';
  return code === 'ER_NO_SUCH_TABLE' && message.includes(tableName);
};

const readExpenseGroupLabel = (expense: {
  expenseGroup: string | null;
  category: string | null;
}): string => (expense.expenseGroup ?? expense.category ?? 'General').trim() || 'General';

const listExpenseGroupLabelsByGroupId = async (groupIds: number[]): Promise<Map<number, string[]>> => {
  const map = new Map<number, string[]>();
  if (groupIds.length === 0) {
    return map;
  }
  let rows: Array<{ groupId: number; category: string } & RowDataPacket> = [];
  try {
    const [templateRows] = await db.query<Array<{ groupId: number; category: string } & RowDataPacket>>(
      `
      SELECT group_id AS groupId, category
      FROM group_split_templates
      WHERE group_id IN (?)
    `,
      [groupIds],
    );
    rows = templateRows;
  } catch (error) {
    if (!isMissingTableError(error, 'group_split_templates')) {
      throw error;
    }
  }
  for (const row of rows) {
    const cat = row.category?.trim();
    if (!cat) {
      continue;
    }
    const list = map.get(row.groupId) ?? [];
    if (!list.some((existing) => existing.toLowerCase() === cat.toLowerCase())) {
      list.push(cat);
    }
    map.set(row.groupId, list);
  }
  for (const [, list] of map) {
    list.sort((left, right) => left.localeCompare(right));
  }
  return map;
};

const listTemplateSplitDetailsByGroupAndCategory = async (
  groupIds: number[],
): Promise<Map<string, Array<{ participant: string; ratio: number }>>> => {
  const map = new Map<string, Array<{ participant: string; ratio: number }>>();
  if (groupIds.length === 0) {
    return map;
  }

  let rows: SplitTemplateRow[] = [];
  try {
    const [templateRows] = await db.query<SplitTemplateRow[]>(
      `
      SELECT
        id,
        group_id AS groupId,
        category,
        template_name AS templateName,
        split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id IN (?)
    `,
      [groupIds],
    );
    rows = templateRows;
  } catch (error) {
    if (!isMissingTableError(error, 'group_split_templates')) {
      throw error;
    }
  }

  for (const row of rows) {
    const categoryKey = row.category.trim().toLowerCase();
    if (!categoryKey) {
      continue;
    }
    map.set(`${row.groupId}:${categoryKey}`, parseTemplateSplitDetails(row.splitDetails));
  }

  return map;
};

const normalizeTemplateSplitDetails = (
  splitDetails: UpsertSplitTemplateInput['splitDetails'],
): Array<{ participant: string; ratio: number }> => {
  const normalized = splitDetails
    .map((item) => ({
      participant: item.participant.trim(),
      ratio: Number(item.ratio),
    }))
    .filter((item) => item.participant.length > 0 && Number.isFinite(item.ratio) && item.ratio > 0);

  if (normalized.length === 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Template split must include at least one member.');
  }

  const ratioTotal = normalized.reduce((sum, item) => sum + item.ratio, 0);
  if (Math.abs(ratioTotal - 100) > 0.01) {
    throw appError(ErrorCode.BAD_USER_INPUT, `Template ratios must add up to 100% (current: ${ratioTotal.toFixed(2)}%).`);
  }

  return normalized.map((item) => ({
    participant: item.participant,
    ratio: Number(item.ratio.toFixed(2)),
  }));
};

const parseTemplateSplitDetails = (
  value: SplitTemplateRow['splitDetails'],
): Array<{ participant: string; ratio: number }> => {
  let parsed: unknown = null;
  if (Array.isArray(value)) {
    parsed = value;
  } else if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }
      const participant =
        'participant' in item && typeof item.participant === 'string' ? item.participant.trim() : '';
      const ratio = 'ratio' in item ? Number(item.ratio) : Number.NaN;
      if (!participant || !Number.isFinite(ratio)) {
        return null;
      }
      return { participant, ratio };
    })
    .filter((item): item is { participant: string; ratio: number } => item !== null);
};

const toSafeGraphqlFloat = (value: number): number => {
  const rounded = roundCents(value);
  return Number.isFinite(rounded) ? rounded : 0;
};
const toSettlementDateString = (value: Date | string | null | undefined): string => {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};
const buildBulkInsertPlaceholders = (rows: number, width: number): string =>
  Array.from({ length: rows }, () => `(${Array.from({ length: width }, () => '?').join(', ')})`).join(', ');

const normalizeSplitDetailsInput = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return null;
};

const parseExpenseSplitDetails = (
  value: unknown,
  expenseAmount?: number,
): Array<{ participant: string; amount: number }> => {
  const normalizedValue = normalizeSplitDetailsInput(value);
  if (!normalizedValue) {
    return [];
  }
  try {
    const parsed = JSON.parse(normalizedValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }
        const participant =
          'participant' in item && typeof item.participant === 'string' ? item.participant.trim() : '';
        const explicitAmount = 'amount' in item ? Number(item.amount) : Number.NaN;
        const ratio = 'ratio' in item ? Number(item.ratio) : Number.NaN;
        let amount = explicitAmount;
        if (
          !Number.isFinite(amount) &&
          Number.isFinite(ratio) &&
          expenseAmount !== undefined &&
          Number.isFinite(expenseAmount)
        ) {
          amount = roundCents((expenseAmount * ratio) / 100);
        }
        if (!participant || !Number.isFinite(amount)) {
          return null;
        }
        return { participant, amount: roundCents(amount) };
      })
      .filter((item): item is { participant: string; amount: number } => item !== null);
  } catch {
    return [];
  }
};

const resolveExpenseSettlementShares = (
  expense: SettlementExpenseRow,
  members: GroupMember[],
  templateSplitByKey: Map<string, Array<{ participant: string; ratio: number }>>,
): Array<{ participant: string; amount: number }> => {
  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  const splitDetails = parseExpenseSplitDetails(expense.splitDetails as unknown, amount);
  const expenseGroupKey = readExpenseGroupLabel(expense).toLowerCase();
  const templateSplit = templateSplitByKey.get(`${expense.groupId}:${expenseGroupKey}`) ?? [];

  if (expense.splitType === 'Custom' && splitDetails.length > 0) {
    return splitDetails;
  }
  if (templateSplit.length > 0) {
    return templateSplit.map((allocation) => ({
      participant: allocation.participant,
      amount: roundCents((amount * allocation.ratio) / 100),
    }));
  }
  if (splitDetails.length > 0) {
    return splitDetails;
  }
  return members.map((member) => ({
    participant: member.name,
    amount: roundCents((amount * member.ratio) / 100),
  }));
};

const buildSettlementForScope = (
  members: GroupMember[],
  expenses: SettlementExpenseRow[],
  payments: SettlementPayment[],
  templateSplitByKey: Map<string, Array<{ participant: string; ratio: number }>>,
): { balances: SettlementBalance[]; transfers: SettlementTransfer[]; totalExpenses: number } => {
  const balanceMap = new Map<string, number>();
  const memberByNormalizedName = new Map(
    members.map((member) => [member.name.trim().toLowerCase(), member]),
  );
  members.forEach((member) => {
    balanceMap.set(member.name, 0);
  });
  let totalExpenses = 0;

  const resolveBalanceMemberName = (memberName: string): string | undefined => {
    const member = memberByNormalizedName.get(memberName.trim().toLowerCase());
    return member?.name;
  };

  expenses.forEach((expense) => {
    const amount = Number(expense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    totalExpenses = roundCents(totalExpenses + amount);
    const shares = resolveExpenseSettlementShares(expense, members, templateSplitByKey);
    shares.forEach((share) => {
      const balanceMemberName = resolveBalanceMemberName(share.participant);
      if (!balanceMemberName) {
        return;
      }
      const previous = balanceMap.get(balanceMemberName) ?? 0;
      balanceMap.set(balanceMemberName, roundCents(previous - share.amount));
    });

    if (expense.paidByName) {
      const payerName = resolveBalanceMemberName(expense.paidByName);
      if (payerName) {
        const previous = balanceMap.get(payerName) ?? 0;
        balanceMap.set(payerName, roundCents(previous + amount));
      }
    }
  });

  payments.forEach((payment) => {
    const paymentAmount = toSafeGraphqlFloat(Number(payment.amount));
    const fromMemberName = resolveBalanceMemberName(payment.fromMember);
    const toMemberName = resolveBalanceMemberName(payment.toMember);
    if (!fromMemberName || !toMemberName) {
      return;
    }
    const fromPrevious = balanceMap.get(fromMemberName) ?? 0;
    const toPrevious = balanceMap.get(toMemberName) ?? 0;
    balanceMap.set(fromMemberName, roundCents(fromPrevious + paymentAmount));
    balanceMap.set(toMemberName, roundCents(toPrevious - paymentAmount));
  });

  const balances = Array.from(balanceMap.entries())
    .map(([memberName, balanceAmount]) => ({
      memberName,
      amount: toSafeGraphqlFloat(balanceAmount),
    }))
    .sort((left, right) => right.amount - left.amount);
  const transfers = buildOptimizedTransfers(balances).map((transfer) => ({
    fromMember: transfer.fromMember,
    toMember: transfer.toMember,
    amount: toSafeGraphqlFloat(transfer.amount),
  }));

  return { balances, transfers, totalExpenses: toSafeGraphqlFloat(totalExpenses) };
};

const expenseRowIsPrivate = (row: { isPrivate?: number }): boolean => row.isPrivate === 1;

type AccessibleGroupWithMembers = {
  id: number;
  name: string;
  description: string | null;
  members: GroupMember[];
};

const loadAccessibleGroupsWithMembers = async (
  viewer: GroupViewer,
): Promise<AccessibleGroupWithMembers[]> => {
  const [groupRows] = await db.query<GroupRow[]>(
    `
      SELECT id, name, description
      FROM \`groups\`
      WHERE id IN (
        SELECT gm.group_id
        FROM group_members gm
        LEFT JOIN group_invitations gi
          ON gi.group_id = gm.group_id AND gi.email = gm.email
        WHERE ${groupMemberMatchesViewerClause('gm')}
          AND (gi.id IS NULL OR gi.status = 'Accepted')
      )
      ORDER BY created_at DESC, id DESC
    `,
    groupMemberMatchesViewerParams(viewer),
  );

  if (groupRows.length === 0) {
    return [];
  }

  const [memberRows] = await db.query<GroupMemberRow[]>(
    `
      SELECT group_id AS groupId, name, email, ratio, user_id AS userId
      FROM group_members
      WHERE group_id IN (?)
      ORDER BY id ASC
    `,
    [groupRows.map((group) => group.id)],
  );

  const membersByGroupId = new Map<number, GroupMember[]>();
  for (const row of memberRows) {
    const existingMembers = membersByGroupId.get(row.groupId) ?? [];
    existingMembers.push(mapGroupMemberRow(row));
    membersByGroupId.set(row.groupId, existingMembers);
  }

  return groupRows.map((group) => ({
    id: group.id,
    name: group.name,
    description: group.description,
    members: membersByGroupId.get(group.id) ?? [],
  }));
};

export const listGroups = async (viewer: GroupViewer): Promise<Group[]> => {
  const viewerUserId = viewer.userId;
  const accessibleGroups = await loadAccessibleGroupsWithMembers(viewer);
  if (accessibleGroups.length === 0) {
    return [];
  }

  const groupRows = accessibleGroups;
  const membersByGroupId = new Map(accessibleGroups.map((group) => [group.id, group.members]));

  const [expenseRows] = await db.query<GroupExpenseRow[]>(
    `
      SELECT
        e.id,
        e.group_id AS groupId,
        e.title,
        e.expense_group AS expenseGroup,
        e.category,
        e.amount,
        e.currency,
        e.split_type AS splitType,
        e.split_details AS splitDetails,
        e.transaction_date AS transactionDate,
        u.full_name AS paidByName,
        COALESCE(e.is_private, 0) AS isPrivate,
        e.created_by_user_id AS createdByUserId
      FROM expenses e
      LEFT JOIN users u ON u.id = e.paid_by_user_id
      WHERE e.group_id IN (?)
        AND COALESCE(e.expense_flow, 'Outgoing') = 'Outgoing'
      ORDER BY e.transaction_date DESC, e.id DESC
    `,
    [groupRows.map((group) => group.id)],
  );

  const expensesByGroupId = new Map<number, Group['expenses']>();
  const totalsByGroupId = new Map<number, { totalSpent: number; yourShare: number }>();
  const templateSplitByKey = await listTemplateSplitDetailsByGroupAndCategory(groupRows.map((group) => group.id));

  for (const row of expenseRows) {
    const isPrivate = expenseRowIsPrivate(row);
    if (isPrivate && String(row.createdByUserId ?? '') !== viewerUserId) {
      continue;
    }
    const groupMembers = membersByGroupId.get(row.groupId) ?? [];
    const viewerMember = findViewerGroupMember(groupMembers, viewer);
    const amount = Number(row.amount);
    const splitDetails = parseExpenseSplitDetails(
      typeof row.splitDetails === 'string' ? row.splitDetails : null,
      amount,
    );

    let yourShare = 0;
    if (isPrivate && String(row.createdByUserId ?? '') === viewerUserId) {
      yourShare = amount;
    } else if (viewerMember) {
      const viewerNameKey = viewerMember.name.trim().toLowerCase();
      const shareFromDetails = splitDetails.find(
        (share) => share.participant.trim().toLowerCase() === viewerNameKey,
      );
      const expenseGroupKey = (row.expenseGroup ?? row.category).trim().toLowerCase();
      const templateSplit = templateSplitByKey.get(`${row.groupId}:${expenseGroupKey}`) ?? [];
      const templateAllocation = templateSplit.find(
        (allocation) => allocation.participant.trim().toLowerCase() === viewerNameKey,
      );

      if (row.splitType === 'Custom' && shareFromDetails) {
        // Preserve explicit one-off custom split allocations.
        yourShare = Number(shareFromDetails.amount.toFixed(2));
      } else if (templateAllocation) {
        // Shared expenses should follow the current expense-group template ratio.
        yourShare = Number(((amount * templateAllocation.ratio) / 100).toFixed(2));
      } else if (shareFromDetails) {
        yourShare = Number(shareFromDetails.amount.toFixed(2));
      } else {
        yourShare = Number(((amount * viewerMember.ratio) / 100).toFixed(2));
      }
    }

    const groupExpenses = expensesByGroupId.get(row.groupId) ?? [];
    groupExpenses.push({
      date: toIsoString(row.transactionDate).slice(0, 10),
      expenseGroup: row.expenseGroup ?? row.category,
      category: row.category,
      description: row.title,
      paidBy: row.paidByName ?? 'Member',
      total: amount,
      yourShare,
      isPrivate,
      currency: row.currency && row.currency.trim() ? row.currency.trim().toUpperCase() : 'DKK',
    });
    expensesByGroupId.set(row.groupId, groupExpenses);

    const runningTotals = totalsByGroupId.get(row.groupId) ?? { totalSpent: 0, yourShare: 0 };
    if (!isPrivate) {
      runningTotals.totalSpent = Number((runningTotals.totalSpent + amount).toFixed(2));
    }
    runningTotals.yourShare = Number((runningTotals.yourShare + yourShare).toFixed(2));
    totalsByGroupId.set(row.groupId, runningTotals);
  }

  const templateLabelsByGroupId = await listExpenseGroupLabelsByGroupId(groupRows.map((group) => group.id));

  const groupIds = groupRows.map((group) => group.id);
  const pendingByGroupId = new Map<number, GroupPendingInvitation[]>();
  if (groupIds.length > 0) {
    const [pendingRows] = await db.query<
      (RowDataPacket & {
        groupId: number;
        email: string;
        name: string;
        status: string;
        emailDeliveryStatus: string | null;
      })[]
    >(
      `
        SELECT
          gi.group_id AS groupId,
          gi.email,
          gm.name,
          gi.status,
          gi.email_delivery_status AS emailDeliveryStatus
        FROM group_invitations gi
        INNER JOIN group_members gm
          ON gm.group_id = gi.group_id AND gm.email = gi.email
        WHERE gi.group_id IN (?)
          AND gi.status = 'Pending'
        ORDER BY gi.invited_at DESC, gi.id DESC
      `,
      [groupIds],
    );
    for (const row of pendingRows) {
      const existing = pendingByGroupId.get(row.groupId) ?? [];
      existing.push({
        email: row.email,
        name: row.name,
        status: mapInvitationStatus(row.status),
        emailDeliveryStatus: mapInvitationEmailDeliveryStatus(row.emailDeliveryStatus),
      });
      pendingByGroupId.set(row.groupId, existing);
    }
  }

  return groupRows.map((row) => ({
    ...(totalsByGroupId.get(row.id) ?? { totalSpent: 0, yourShare: 0 }),
    id: String(row.id),
    name: row.name,
    description: row.description ?? undefined,
    members: membersByGroupId.get(row.id) ?? [],
    expenses: expensesByGroupId.get(row.id) ?? [],
    expenseGroupLabels: templateLabelsByGroupId.get(row.id) ?? [],
    pendingInvitations: pendingByGroupId.get(row.id) ?? [],
  }));
};

export const createGroup = async (input: CreateGroupInput, actor: GroupViewer): Promise<Group> => {
  const name = stripControlCharacters(input.name.trim());
  if (!name) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Group name is required.');
  }

  const members = normalizeMembers(input.members).filter((member) => member.name && member.email);
  if (members.length < 2) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'A group must include at least two members.');
  }

  const totalRatio = members.reduce((sum, member) => sum + member.ratio, 0);
  if (Math.abs(totalRatio - 100) > 0.01) {
    throw appError(ErrorCode.BAD_USER_INPUT, `Member ratios must add up to 100% (current: ${totalRatio.toFixed(2)}%).`);
  }
  if (members.some((member) => !Number.isFinite(member.ratio) || member.ratio <= 0)) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Each member ratio must be greater than 0.');
  }

  const duplicateEmails = new Set<string>();
  for (const member of members) {
    if (duplicateEmails.has(member.email)) {
      throw appError(ErrorCode.BAD_USER_INPUT, 'Each group member must have a unique email.');
    }
    duplicateEmails.add(member.email);
  }

  const normalizedActorEmail = normalizeMemberEmail(actor.email);
  const actorInMembers = members.some((member) => member.email === normalizedActorEmail);
  if (!actorInMembers) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Group creator must be included in members.');
  }

  let memberEmailsHavingAccounts = new Set<string>();
  const connection = await db.getConnection();
  let groupId = 0;
  try {
    await connection.beginTransaction();

    const [insertResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO \`groups\` (name, description)
        VALUES (?, ?)
      `,
      [name, input.description?.trim() || null],
    );

    groupId = insertResult.insertId;

    const userIdsByEmail = await loadUserIdsByEmails(members.map((member) => member.email));

    if (members.length > 0) {
      const memberPlaceholders = buildBulkInsertPlaceholders(members.length, 5);
      const memberValues = members.flatMap((member) => [
        groupId,
        member.name,
        member.email,
        member.ratio,
        userIdsByEmail.get(member.email) ?? null,
      ]);
      await connection.execute(
        `
          INSERT INTO group_members (group_id, name, email, ratio, user_id)
          VALUES ${memberPlaceholders}
        `,
        memberValues,
      );
    }

    memberEmailsHavingAccounts = new Set(
      members
        .filter((member) => userIdsByEmail.has(member.email))
        .map((member) => member.email),
    );

    const invitedEmails = members
      .map((member) => member.email)
      .filter((email) => email !== normalizedActorEmail);
    await upsertPendingInvitations(connection, groupId, invitedEmails);
    await deleteInvitationsNotInEmails(
      connection,
      groupId,
      members.map((member) => member.email),
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const inviteTargets = members
    .filter((member) => member.email !== normalizedActorEmail)
    .map((member) => ({
      email: member.email,
      name: member.name,
      hasAccount: memberEmailsHavingAccounts.has(member.email),
    }));

  if (inviteTargets.length > 0) {
    queueHouseholdMemberInviteEmails({
      groupId,
      groupName: name,
      actorEmail: normalizedActorEmail,
      targets: inviteTargets,
    });
  }

  return {
    id: String(groupId),
    name,
    description: input.description?.trim() || undefined,
    members,
    totalSpent: 0,
    yourShare: 0,
    expenses: [],
    expenseGroupLabels: [],
    pendingInvitations: inviteTargets.map((target) => ({
      email: target.email,
      name: target.name,
      status: 'Pending' as const,
      emailDeliveryStatus: undefined,
    })),
  };
};

export const updateGroup = async (input: UpdateGroupInput, actor: GroupViewer): Promise<Group> => {
  const numericGroupId = Number(input.id);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid group id.');
  }

  const name = stripControlCharacters(input.name.trim());
  if (!name) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Group name is required.');
  }

  const members = normalizeMembers(input.members).filter((member) => member.name && member.email);
  if (members.length < 2) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'A group must include at least two members.');
  }

  const totalRatio = members.reduce((sum, member) => sum + member.ratio, 0);
  if (Math.abs(totalRatio - 100) > 0.01) {
    throw appError(ErrorCode.BAD_USER_INPUT, `Member ratios must add up to 100% (current: ${totalRatio.toFixed(2)}%).`);
  }
  if (members.some((member) => !Number.isFinite(member.ratio) || member.ratio <= 0)) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Each member ratio must be greater than 0.');
  }

  const duplicateEmails = new Set<string>();
  for (const member of members) {
    if (duplicateEmails.has(member.email)) {
      throw appError(ErrorCode.BAD_USER_INPUT, 'Each group member must have a unique email.');
    }
    duplicateEmails.add(member.email);
  }

  const normalizedActorEmail = normalizeMemberEmail(actor.email);
  const [beforeRows] = await db.query<GroupRow[]>(
    `
      SELECT id, name, description
      FROM \`groups\`
      WHERE id = ?
      LIMIT 1
    `,
    [numericGroupId],
  );
  const beforeGroup = beforeRows[0];
  if (!beforeGroup) {
    throw appError(ErrorCode.NOT_FOUND, 'Group not found.');
  }
  const [beforeMemberRows] = await db.query<GroupMemberRow[]>(
    `
      SELECT group_id AS groupId, name, email, ratio, user_id AS userId
      FROM group_members
      WHERE group_id = ?
      ORDER BY id ASC
    `,
    [numericGroupId],
  );
  const [membershipRows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ?
        AND ${groupMemberMatchesViewerClause()}
      LIMIT 1
    `,
    [numericGroupId, ...groupMemberMatchesViewerParams(actor)],
  );
  if (membershipRows.length === 0) {
    logAuthzDenied('group_access_denied', {
      groupId: String(numericGroupId),
      email: normalizedActorEmail,
      userId: actor.userId,
      action: 'updateGroup',
    });
    throw appError(ErrorCode.FORBIDDEN, 'Not authorized for this group.');
  }

  const actorInMembers = members.some((member) => member.email === normalizedActorEmail);
  if (!actorInMembers) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Group editor must remain in members.');
  }

  const beforeEmailSet = new Set(beforeMemberRows.map((member) => member.email.trim().toLowerCase()));
  let memberEmailsHavingAccounts = new Set<string>();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `
        UPDATE \`groups\`
        SET name = ?, description = ?
        WHERE id = ?
      `,
      [name, input.description?.trim() || null, numericGroupId],
    );

    await connection.execute(
      `
        DELETE FROM group_members
        WHERE group_id = ?
      `,
      [numericGroupId],
    );

    const userIdsByEmail = await loadUserIdsByEmails(members.map((member) => member.email));

    if (members.length > 0) {
      const memberPlaceholders = buildBulkInsertPlaceholders(members.length, 5);
      const memberValues = members.flatMap((member) => [
        numericGroupId,
        member.name,
        member.email,
        member.ratio,
        userIdsByEmail.get(member.email) ?? null,
      ]);
      await connection.execute(
        `
          INSERT INTO group_members (group_id, name, email, ratio, user_id)
          VALUES ${memberPlaceholders}
        `,
        memberValues,
      );
    }

    memberEmailsHavingAccounts = new Set(
      members
        .filter((member) => userIdsByEmail.has(member.email))
        .map((member) => member.email),
    );

    const newInvitedEmails = members
      .map((member) => member.email)
      .filter((email) => email !== normalizedActorEmail && !beforeEmailSet.has(email));
    await upsertPendingInvitations(connection, numericGroupId, newInvitedEmails);
    await deleteInvitationsNotInEmails(
      connection,
      numericGroupId,
      members.map((member) => member.email),
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const newInviteTargets = members
    .filter((member) => member.email !== normalizedActorEmail && !beforeEmailSet.has(member.email))
    .map((member) => ({
      email: member.email,
      name: member.name,
      hasAccount: memberEmailsHavingAccounts.has(member.email),
    }));

  if (newInviteTargets.length > 0) {
    queueHouseholdMemberInviteEmails({
      groupId: numericGroupId,
      groupName: name,
      actorEmail: normalizedActorEmail,
      targets: newInviteTargets,
    });
  }

  const [groupRows] = await db.query<GroupRow[]>(
    `
      SELECT id, name, description
      FROM \`groups\`
      WHERE id = ?
      LIMIT 1
    `,
    [numericGroupId],
  );
  const groupRow = groupRows[0];
  if (!groupRow) {
    throw appError(ErrorCode.NOT_FOUND, 'Group not found.');
  }

  await logAuditEvent({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    action: 'UPDATE_GROUP',
    entityType: 'group',
    entityId: String(groupRow.id),
    beforeState: {
      id: beforeGroup.id,
      name: beforeGroup.name,
      description: beforeGroup.description,
      members: beforeMemberRows.map((member) => ({
        name: member.name,
        email: member.email,
        ratio: toNumericRatio(member.ratio),
      })),
    },
    afterState: {
      id: groupRow.id,
      name: groupRow.name,
      description: groupRow.description,
      members,
    },
  });

  const templateLabelsByGroupId = await listExpenseGroupLabelsByGroupId([numericGroupId]);

  return {
    id: String(groupRow.id),
    name: groupRow.name,
    description: groupRow.description ?? undefined,
    members,
    totalSpent: 0,
    yourShare: 0,
    expenses: [],
    expenseGroupLabels: templateLabelsByGroupId.get(numericGroupId) ?? [],
    pendingInvitations: newInviteTargets.map((target) => ({
      email: target.email,
      name: target.name,
      status: 'Pending' as const,
      emailDeliveryStatus: undefined,
    })),
  };
};

export const listInvitations = async (viewer: GroupViewer): Promise<GroupInvitation[]> => {
  const normalizedEmail = normalizeMemberEmail(viewer.email);
  const viewerUserId = parseViewerUserId(viewer.userId);
  const [rows] = await db.query<GroupInvitationRow[]>(
    `
      SELECT
        gi.id,
        gi.group_id AS groupId,
        g.name AS groupName,
        gi.email,
        gi.status,
        gi.email_delivery_status AS emailDeliveryStatus,
        gi.invited_at AS invitedAt,
        gi.accepted_at AS acceptedAt
      FROM group_invitations gi
      INNER JOIN \`groups\` g ON g.id = gi.group_id
      WHERE gi.status = 'Pending'
        AND (
          gi.email = ?
          OR gi.invited_user_id = ?
          OR (
            ? IS NOT NULL
            AND gi.email IN (SELECT email FROM users WHERE id = ?)
          )
        )
      ORDER BY gi.invited_at DESC, gi.id DESC
    `,
    [normalizedEmail, viewerUserId, viewerUserId, viewerUserId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    groupId: String(row.groupId),
    groupName: row.groupName,
    email: row.email,
    status: mapInvitationStatus(row.status),
    emailDeliveryStatus: mapInvitationEmailDeliveryStatus(row.emailDeliveryStatus),
    invitedAt: toIsoString(row.invitedAt),
    acceptedAt: row.acceptedAt ? toIsoString(row.acceptedAt) : undefined,
  }));
};

export const listSplitTemplates = async (groupId: string, viewer: GroupViewer): Promise<SplitTemplate[]> => {
  const numericGroupId = Number(groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid groupId.');
  }

  await assertActiveGroupMembership(numericGroupId, viewer, 'listSplitTemplates');

  const [rows] = await db.query<SplitTemplateRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        category,
        template_name AS templateName,
        split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id = ?
      ORDER BY category ASC, id ASC
    `,
    [numericGroupId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    groupId: String(row.groupId),
    category: row.category,
    templateName: row.templateName,
    splitDetails: parseTemplateSplitDetails(row.splitDetails),
  }));
};

export const upsertSplitTemplate = async (
  input: UpsertSplitTemplateInput,
  viewer: GroupViewer,
): Promise<SplitTemplate> => {
  const numericGroupId = Number(input.groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid groupId.');
  }

  const normalizedEmail = normalizeMemberEmail(viewer.email);
  await assertActiveGroupMembership(numericGroupId, viewer, 'upsertSplitTemplate');

  const category = input.category.trim();
  const templateName = input.templateName.trim();
  if (!category) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Template category is required.');
  }
  if (!templateName) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Template name is required.');
  }

  const splitDetails = normalizeTemplateSplitDetails(input.splitDetails);
  const splitDetailsJson = JSON.stringify(splitDetails);

  const [existingTemplateRows] = await db.query<SplitTemplateRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        category,
        template_name AS templateName,
        split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id = ? AND category = ?
      LIMIT 1
    `,
    [numericGroupId, category],
  );
  const previousParticipants = new Set(
    parseTemplateSplitDetails(existingTemplateRows[0]?.splitDetails).map((entry) =>
      entry.participant.trim().toLowerCase(),
    ),
  );
  const addedParticipantNames = splitDetails
    .map((entry) => entry.participant.trim().toLowerCase())
    .filter((participant) => participant.length > 0 && !previousParticipants.has(participant));

  await db.execute(
    `
      INSERT INTO group_split_templates (group_id, category, template_name, split_details)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        template_name = VALUES(template_name),
        split_details = VALUES(split_details)
    `,
    [numericGroupId, category, templateName, splitDetailsJson],
  );

  const [rows] = await db.query<SplitTemplateRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        category,
        template_name AS templateName,
        split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id = ? AND category = ?
      LIMIT 1
    `,
    [numericGroupId, category],
  );
  const row = rows[0];
  if (!row) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Failed to upsert split template.');
  }

  if (addedParticipantNames.length > 0) {
    const [groupRows] = await db.query<GroupRow[]>(
      `
        SELECT id, name, description
        FROM \`groups\`
        WHERE id = ?
        LIMIT 1
      `,
      [numericGroupId],
    );
    const groupName = groupRows[0]?.name ?? 'Household';
    const [householdMembers] = await db.query<GroupMemberRow[]>(
      `
        SELECT group_id AS groupId, name, email, ratio, user_id AS userId
        FROM group_members
        WHERE group_id = ?
      `,
      [numericGroupId],
    );
    const memberByName = new Map(
      householdMembers.map((member) => [member.name.trim().toLowerCase(), member]),
    );
    const notifyTargets = addedParticipantNames
      .map((participantName) => memberByName.get(participantName))
      .filter((member): member is GroupMemberRow => Boolean(member))
      .filter((member) => member.email.trim().toLowerCase() !== normalizedEmail)
      .map((member) => ({ email: member.email, name: member.name }));

    if (notifyTargets.length > 0) {
      queueExpenseGroupAddedEmails({
        groupName,
        expenseGroupName: category,
        actorEmail: normalizedEmail,
        targets: notifyTargets,
      });
    }
  }

  return {
    id: String(row.id),
    groupId: String(row.groupId),
    category: row.category,
    templateName: row.templateName,
    splitDetails: parseTemplateSplitDetails(row.splitDetails),
  };
};

export const deleteExpenseGroup = async (
  groupId: string,
  category: string,
  viewer: GroupViewer,
): Promise<boolean> => {
  const numericGroupId = Number(groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid groupId.');
  }
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Expense group category is required.');
  }

  await assertActiveGroupMembership(numericGroupId, viewer, 'deleteExpenseGroup');

  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM group_split_templates WHERE group_id = ? AND category = ?',
    [numericGroupId, normalizedCategory],
  );

  return result.affectedRows > 0;
};

const listSettlementPaymentRows = async (
  groupIds: number[],
  periodStartIso?: string,
): Promise<SettlementPaymentRow[]> => {
  if (groupIds.length === 0) {
    return [];
  }
  try {
    const periodFilter = periodStartIso ? 'AND settled_at >= ?' : '';
    const params: Array<number[] | string> = [groupIds];
    if (periodStartIso) {
      params.push(periodStartIso);
    }
    const [paymentRows] = await db.query<SettlementPaymentRow[]>(
      `
      SELECT
        id,
        group_id AS groupId,
        expense_group AS expenseGroup,
        from_member AS fromMember,
        to_member AS toMember,
        amount,
        note,
        settled_at AS settledAt
      FROM settlement_payments
      WHERE group_id IN (?)
        ${periodFilter}
      ORDER BY settled_at DESC, id DESC
    `,
      params,
    );
    return paymentRows;
  } catch (error) {
    if (isMissingTableError(error, 'settlement_payments')) {
      return [];
    }
    throw error;
  }
};

export const listHouseholdSettlements = async (
  viewer: GroupViewer,
  periodInput?: unknown,
): Promise<HouseholdSettlement[]> => {
  try {
    return await listHouseholdSettlementsImpl(viewer, periodInput);
  } catch (error) {
    console.error('[listHouseholdSettlements]', error);
    throw error;
  }
};

type SanitizedSettlementScope = {
  balances: SettlementBalance[];
  transfers: SettlementTransfer[];
  totalExpenses: number;
};

const sanitizeSettlementScope = (computed: {
  balances: SettlementBalance[];
  transfers: SettlementTransfer[];
  totalExpenses: number;
}): SanitizedSettlementScope => ({
  totalExpenses: toSafeGraphqlFloat(computed.totalExpenses),
  balances: computed.balances.map((balance) => ({
    memberName: balance.memberName,
    amount: toSafeGraphqlFloat(balance.amount),
  })),
  transfers: computed.transfers.map((transfer) => ({
    fromMember: transfer.fromMember,
    toMember: transfer.toMember,
    amount: toSafeGraphqlFloat(transfer.amount),
  })),
});

const buildExpenseGroupSettlements = (
  members: GroupMember[],
  groupExpenses: SettlementExpenseRow[],
  groupPayments: SettlementPayment[],
  templateSplitByKey: Awaited<ReturnType<typeof listTemplateSplitDetailsByGroupAndCategory>>,
): ExpenseGroupSettlement[] => {
  const expenseGroupNames = new Set(groupExpenses.map((expense) => readExpenseGroupLabel(expense)));
  return Array.from(expenseGroupNames)
    .sort((left, right) => left.localeCompare(right))
    .map((expenseGroupName) => {
      const scopedExpenses = groupExpenses.filter(
        (expense) => readExpenseGroupLabel(expense).toLowerCase() === expenseGroupName.toLowerCase(),
      );
      const scopedPayments = groupPayments.filter(
        (payment) => payment.expenseGroup?.trim().toLowerCase() === expenseGroupName.toLowerCase(),
      );
      const computed = sanitizeSettlementScope(
        buildSettlementForScope(members, scopedExpenses, scopedPayments, templateSplitByKey),
      );
      return {
        expenseGroup: expenseGroupName,
        totalExpenses: computed.totalExpenses,
        balances: computed.balances,
        transfers: computed.transfers,
      };
    });
};

const buildCurrencySettlementScope = (
  currency: string,
  members: GroupMember[],
  groupExpenses: SettlementExpenseRow[],
  groupPayments: SettlementPayment[],
  templateSplitByKey: Awaited<ReturnType<typeof listTemplateSplitDetailsByGroupAndCategory>>,
): CurrencySettlementScope => {
  const householdComputed = sanitizeSettlementScope(
    buildSettlementForScope(
      members,
      groupExpenses,
      groupPayments.filter((payment) => !payment.expenseGroup),
      templateSplitByKey,
    ),
  );
  return {
    currency,
    totalExpenses: householdComputed.totalExpenses,
    balances: householdComputed.balances,
    transfers: householdComputed.transfers,
    expenseGroups: buildExpenseGroupSettlements(members, groupExpenses, groupPayments, templateSplitByKey),
  };
};

const groupSettlementExpensesByCurrency = (
  expenses: SettlementExpenseRow[],
): Map<string, SettlementExpenseRow[]> => {
  const byCurrency = new Map<string, SettlementExpenseRow[]>();
  for (const expense of expenses) {
    const currency = normalizeExpenseCurrency(expense.currency);
    const bucket = byCurrency.get(currency) ?? [];
    bucket.push(expense);
    byCurrency.set(currency, bucket);
  }
  return byCurrency;
};

const listHouseholdSettlementsImpl = async (
  viewer: GroupViewer,
  periodInput?: unknown,
): Promise<HouseholdSettlement[]> => {
  const period = parseSettlementPeriod(periodInput);
  const { startIso: periodStartIso } = settlementPeriodRange(period);
  const groups = await loadAccessibleGroupsWithMembers(viewer);
  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((group) => group.id);
  const templateSplitByKey = await listTemplateSplitDetailsByGroupAndCategory(groupIds);
  const [expenseRows] = await db.query<SettlementExpenseRow[]>(
    `
      SELECT
        e.id,
        e.group_id AS groupId,
        e.amount,
        e.currency,
        e.expense_group AS expenseGroup,
        e.category,
        e.split_type AS splitType,
        e.split_details AS splitDetails,
        payer.full_name AS paidByName
      FROM expenses e
      LEFT JOIN users payer ON payer.id = e.paid_by_user_id
      WHERE e.group_id IN (?)
        AND COALESCE(e.is_private, 0) = 0
        AND COALESCE(e.expense_flow, 'Outgoing') = 'Outgoing'
        AND e.transaction_date >= ?
      ORDER BY e.transaction_date DESC, e.id DESC
    `,
    [groupIds, periodStartIso],
  );
  const paymentRows = await listSettlementPaymentRows(groupIds, periodStartIso);

  const expensesByGroupId = new Map<number, SettlementExpenseRow[]>();
  expenseRows.forEach((row) => {
    const existing = expensesByGroupId.get(row.groupId) ?? [];
    existing.push(row);
    expensesByGroupId.set(row.groupId, existing);
  });
  const paymentsByGroupId = new Map<number, SettlementPayment[]>();
  paymentRows.forEach((row) => {
    const existing = paymentsByGroupId.get(row.groupId) ?? [];
    existing.push({
      id: String(row.id),
      groupId: String(row.groupId),
      expenseGroup: row.expenseGroup ?? undefined,
      fromMember: row.fromMember,
      toMember: row.toMember,
      amount: toSafeGraphqlFloat(Number(row.amount)),
      note: row.note ?? undefined,
      settledAt:
        toSettlementDateString(row.settledAt) || new Date().toISOString().slice(0, 10),
    });
    paymentsByGroupId.set(row.groupId, existing);
  });

  return groups.map((group) => {
    const groupExpenses = expensesByGroupId.get(group.id) ?? [];
    const groupPayments = paymentsByGroupId.get(group.id) ?? [];
    const byCurrency = groupSettlementExpensesByCurrency(groupExpenses);
    const currencies = Array.from(byCurrency.keys()).sort();
    const currencyScopes = currencies.map((currency) =>
      buildCurrencySettlementScope(
        currency,
        group.members,
        byCurrency.get(currency) ?? [],
        groupPayments,
        templateSplitByKey,
      ),
    );
    const primary = currencyScopes[0];

    return {
      groupId: String(group.id),
      groupName: group.name,
      balances: primary?.balances ?? [],
      transfers: primary?.transfers ?? [],
      expenseGroups: primary?.expenseGroups ?? [],
      payments: groupPayments,
      mixedCurrencyWarning: currencies.length > 1,
      currencyScopes,
    };
  });
};

export const recordSettlementPayment = async (
  input: RecordSettlementPaymentInput,
  viewer: GroupViewer,
): Promise<SettlementPayment> => {
  const groupId = Number(input.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid groupId.');
  }
  const normalizedEmail = normalizeMemberEmail(viewer.email);
  const [membershipRows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ?
        AND ${groupMemberMatchesViewerClause()}
      LIMIT 1
    `,
    [groupId, ...groupMemberMatchesViewerParams(viewer)],
  );
  if (membershipRows.length === 0) {
    logAuthzDenied('group_access_denied', {
      groupId: String(groupId),
      email: normalizedEmail,
      userId: viewer.userId,
      action: 'recordSettlementPayment',
    });
    throw appError(ErrorCode.FORBIDDEN, 'Not authorized for this group.');
  }

  const fromMember = input.fromMember.trim();
  const toMember = input.toMember.trim();
  const amount = Number(input.amount);
  const settledAt = input.settledAt.trim();
  if (!fromMember || !toMember || fromMember.toLowerCase() === toMember.toLowerCase()) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Provide valid payer and recipient members.');
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Settlement amount must be greater than 0.');
  }
  if (!settledAt) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Settlement date is required.');
  }

  const [result] = await db.execute<ResultSetHeader>(
    `
      INSERT INTO settlement_payments (
        group_id, expense_group, from_member, to_member, amount, note, settled_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      groupId,
      input.expenseGroup?.trim() || null,
      fromMember,
      toMember,
      roundCents(amount),
      input.note?.trim() || null,
      settledAt,
    ],
  );
  const [rows] = await db.query<SettlementPaymentRow[]>(
    `
      SELECT
        id,
        group_id AS groupId,
        expense_group AS expenseGroup,
        from_member AS fromMember,
        to_member AS toMember,
        amount,
        note,
        settled_at AS settledAt
      FROM settlement_payments
      WHERE id = ?
      LIMIT 1
    `,
    [result.insertId],
  );
  const row = rows[0];
  if (!row) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Unable to record settlement payment.');
  }
  return {
    id: String(row.id),
    groupId: String(row.groupId),
    expenseGroup: row.expenseGroup ?? undefined,
    fromMember: row.fromMember,
    toMember: row.toMember,
    amount: Number(row.amount),
    note: row.note ?? undefined,
    settledAt: toSettlementDateString(row.settledAt),
  };
};
