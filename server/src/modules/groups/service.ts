import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { buildBulkInsertPlaceholders } from '../../db/queryHelpers.js';
import { db } from '../../db/mysql.js';
import type {
  CreateGroupInput,
  Group,
  GroupInvitation,
  GroupMember,
  GroupPendingInvitation,
  InvitationEmailDeliveryStatus,
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
import {
  GROUP_CORE_COLUMNS,
  GROUP_LIST_EXPENSE_COLUMNS,
  GROUP_MEMBER_COLUMNS,
  PENDING_GROUP_INVITATION_COLUMNS,
} from '../../db/sqlColumns.js';
import {
  expenseGroupTemplateLookupKey,
  viewerParticipatesInExpenseGroup,
} from './expenseVisibility.js';
import { loadAccessibleGroupsWithMembers } from './groupMembership.js';
import {
  listExpenseGroupLabelsByGroupId,
  listTemplateSplitDetailsByGroupAndCategory,
} from './groupSplitTemplates.js';
import {
  parseExpenseSettlementAmounts,
  parseTemplateSplitRatios,
} from './splitDetailsParse.js';

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

const expenseRowIsPrivate = (row: { isPrivate?: number }): boolean => row.isPrivate === 1;

export const getGroupForViewer = async (viewer: GroupViewer, groupId: string): Promise<Group | null> => {
  const groups = await listGroups(viewer);
  return groups.find((group) => group.id === groupId) ?? null;
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
        ${GROUP_LIST_EXPENSE_COLUMNS}
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
    if (expenseRowIsPrivate(row)) {
      continue;
    }
    const groupMembers = membersByGroupId.get(row.groupId) ?? [];
    const viewerMember = findViewerGroupMember(groupMembers, viewer);
    if (!viewerMember) {
      continue;
    }
    const amount = Number(row.amount);
    const templateSplit =
      templateSplitByKey.get(
        expenseGroupTemplateLookupKey(row.groupId, row.expenseGroup, row.category),
      ) ?? [];
    if (
      !viewerParticipatesInExpenseGroup(
        viewerMember.name,
        row.splitType ?? 'Shared',
        typeof row.splitDetails === 'string' ? row.splitDetails : null,
        templateSplit,
        amount,
      )
    ) {
      continue;
    }
    const splitDetails = parseExpenseSettlementAmounts(
      typeof row.splitDetails === 'string' ? row.splitDetails : null,
      amount,
    );

    let yourShare = 0;
    if (viewerMember) {
      const viewerNameKey = viewerMember.name.trim().toLowerCase();
      const shareFromDetails = splitDetails.find(
        (share) => share.participant.trim().toLowerCase() === viewerNameKey,
      );
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
      isPrivate: false,
      currency: row.currency && row.currency.trim() ? row.currency.trim().toUpperCase() : 'DKK',
    });
    expensesByGroupId.set(row.groupId, groupExpenses);

    const runningTotals = totalsByGroupId.get(row.groupId) ?? { totalSpent: 0, yourShare: 0 };
    runningTotals.totalSpent = Number((runningTotals.totalSpent + amount).toFixed(2));
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
          ${PENDING_GROUP_INVITATION_COLUMNS}
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
      SELECT ${GROUP_CORE_COLUMNS}
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
      SELECT ${GROUP_MEMBER_COLUMNS}
      FROM group_members
      WHERE group_id = ?
      ORDER BY id ASC
    `,
    [numericGroupId],
  );
  await assertActiveGroupMembership(numericGroupId, actor, 'updateGroup');

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
      SELECT ${GROUP_CORE_COLUMNS}
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
    splitDetails: parseTemplateSplitRatios(row.splitDetails),
  }));
};

export const upsertSplitTemplate = async (
  input: UpsertSplitTemplateInput,
  viewer: GroupViewer,
): Promise<Group> => {
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
    parseTemplateSplitRatios(existingTemplateRows[0]?.splitDetails).map((entry) =>
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
        SELECT ${GROUP_CORE_COLUMNS}
        FROM \`groups\`
        WHERE id = ?
        LIMIT 1
      `,
      [numericGroupId],
    );
    const groupName = groupRows[0]?.name ?? 'Household';
    const [householdMembers] = await db.query<GroupMemberRow[]>(
      `
        SELECT ${GROUP_MEMBER_COLUMNS}
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

  const group = await getGroupForViewer(viewer, input.groupId);
  if (!group) {
    throw appError(ErrorCode.NOT_FOUND, 'Household not found.');
  }
  return group;
};

export const deleteExpenseGroup = async (
  groupId: string,
  category: string,
  viewer: GroupViewer,
): Promise<Group> => {
  const numericGroupId = Number(groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid groupId.');
  }
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Expense group category is required.');
  }

  await assertActiveGroupMembership(numericGroupId, viewer, 'deleteExpenseGroup');

  await db.execute<ResultSetHeader>(
    'DELETE FROM group_split_templates WHERE group_id = ? AND category = ?',
    [numericGroupId, normalizedCategory],
  );

  const group = await getGroupForViewer(viewer, groupId);
  if (!group) {
    throw appError(ErrorCode.NOT_FOUND, 'Household not found.');
  }
  return group;
};

export {
  listHouseholdSettlements,
  getHouseholdSettlement,
  recordSettlementPayment,
} from './settlementsService.js';
export { listTemplateSplitDetailsByGroupAndCategory } from './groupSplitTemplates.js';
