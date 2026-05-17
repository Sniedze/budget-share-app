import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { buildBulkInsertPlaceholders } from '../../db/queryHelpers.js';
import { db } from '../../db/mysql.js';
import { toIsoString } from '../../lib/dates.js';
import { stripParticipantFromTemplateSplitJson } from './splitDetailsParse.js';
import { appError, ErrorCode } from '../../graphql/appError.js';
import { logAuthzDenied } from '../../logger.js';
import { updateInvitationEmailDeliveryStatus } from '../email/invitationEmailStatus.js';
import { sendHouseholdMemberInviteEmails } from '../email/sendMemberNotifications.js';
import {
  type GroupViewer,
  groupMemberMatchesViewerClause,
  groupMemberMatchesViewerParams,
  loadUserIdsByEmails,
  loadViewerGroupMemberName,
  normalizeMemberEmail,
  parseViewerUserId,
} from './memberIdentity.js';
import type {
  GroupInvitation,
  GroupInvitationStatus,
  GroupPendingInvitation,
  InvitationEmailDeliveryStatus,
} from './types.js';

type InvitationRow = {
  id: number;
  groupId: number;
  groupName: string;
  email: string;
  status: string;
  emailDeliveryStatus: string | null;
  invitedAt: Date | string;
  acceptedAt: Date | string | null;
} & RowDataPacket;

export const mapInvitationStatus = (status: string): GroupInvitationStatus => {
  if (status === 'Accepted') {
    return 'Accepted';
  }
  if (status === 'Declined') {
    return 'Declined';
  }
  return 'Pending';
};

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

export const upsertPendingInvitations = async (
  connection: PoolConnection,
  groupId: number,
  emails: string[],
): Promise<void> => {
  if (emails.length === 0) {
    return;
  }
  const userIdsByEmail = await loadUserIdsByEmails(emails);
  const invitationPlaceholders = buildBulkInsertPlaceholders(emails.length, 3);
  const invitationValues = emails.flatMap((email) => {
    const normalized = normalizeMemberEmail(email);
    return [groupId, normalized, userIdsByEmail.get(normalized) ?? null];
  });
  await connection.execute(
    `
      INSERT INTO group_invitations (group_id, email, invited_user_id, status, email_delivery_status)
      VALUES ${invitationPlaceholders.replace(/\(\?, \?, \?\)/g, "(?, ?, ?, 'Pending', 'pending_email')")}
      ON DUPLICATE KEY UPDATE
        status = 'Pending',
        invited_user_id = VALUES(invited_user_id),
        accepted_at = NULL,
        email_delivery_status = 'pending_email'
    `,
    invitationValues,
  );
};

export const deleteInvitationsNotInEmails = async (
  connection: PoolConnection,
  groupId: number,
  memberEmails: string[],
): Promise<void> => {
  if (memberEmails.length === 0) {
    await connection.execute(
      `
        DELETE FROM group_invitations
        WHERE group_id = ?
      `,
      [groupId],
    );
    return;
  }
  const placeholders = buildBulkInsertPlaceholders(memberEmails.length, 1);
  await connection.execute(
    `
      DELETE FROM group_invitations
      WHERE group_id = ?
        AND email NOT IN (${placeholders})
    `,
    [groupId, ...memberEmails],
  );
};

export const assertActiveGroupMembership = async (
  groupId: number,
  viewer: GroupViewer,
  action: string,
): Promise<void> => {
  const normalizedEmail = normalizeMemberEmail(viewer.email);
  const [memberRows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM group_members
      WHERE group_id = ?
        AND ${groupMemberMatchesViewerClause()}
      LIMIT 1
    `,
    [groupId, ...groupMemberMatchesViewerParams(viewer)],
  );
  if (memberRows.length === 0) {
    logAuthzDenied('group_access_denied', {
      groupId: String(groupId),
      email: normalizedEmail,
      userId: viewer.userId,
      action,
    });
    throw appError(ErrorCode.FORBIDDEN, 'Not authorized for this group.');
  }

  const [invitationRows] = await db.query<Array<{ status: string } & RowDataPacket>>(
    `
      SELECT status
      FROM group_invitations
      WHERE group_id = ? AND email = ?
      LIMIT 1
    `,
    [groupId, normalizedEmail],
  );
  const status = invitationRows[0]?.status;
  if (status && status !== 'Accepted') {
    throw appError(ErrorCode.FORBIDDEN, 'Accept the household invitation before accessing this group.');
  }
};

export const backfillAcceptedInvitationsForExistingMembers = async (): Promise<void> => {
  await db.execute(`
    INSERT INTO group_invitations (group_id, email, status, accepted_at)
    SELECT gm.group_id, gm.email, 'Accepted', CURRENT_TIMESTAMP
    FROM group_members gm
    LEFT JOIN group_invitations gi
      ON gi.group_id = gm.group_id AND gi.email = gm.email
    WHERE gi.id IS NULL
  `);
};

const getInvitationRowForUser = async (
  invitationId: number,
  userEmail: string,
): Promise<InvitationRow | null> => {
  const normalizedEmail = userEmail.trim().toLowerCase();
  const [rows] = await db.query<InvitationRow[]>(
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
      WHERE gi.id = ?
        AND gi.email = ?
      LIMIT 1
    `,
    [invitationId, normalizedEmail],
  );
  return rows[0] ?? null;
};

const removeMemberFromHousehold = async (groupId: number, email: string, memberName: string): Promise<void> => {
  await db.execute(
    `
      DELETE FROM group_members
      WHERE group_id = ? AND email = ?
    `,
    [groupId, email],
  );

  const [templateRows] = await db.query<Array<{ id: number; splitDetails: string } & RowDataPacket>>(
    `
      SELECT id, split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id = ?
    `,
    [groupId],
  );

  for (const row of templateRows) {
    const splitDetailsJson = stripParticipantFromTemplateSplitJson(
      typeof row.splitDetails === 'string' ? row.splitDetails : '[]',
      memberName,
    );
    await db.execute(
      `
        UPDATE group_split_templates
        SET split_details = ?
        WHERE id = ?
      `,
      [splitDetailsJson, row.id],
    );
  }
};

export const acceptGroupInvitation = async (
  invitationId: string,
  viewer: GroupViewer,
): Promise<GroupInvitation> => {
  const numericId = Number(invitationId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid invitation id.');
  }

  const row = await getInvitationRowForUser(numericId, viewer.email);
  if (!row) {
    throw appError(ErrorCode.NOT_FOUND, 'Invitation not found.');
  }
  if (row.status === 'Accepted') {
    return {
      id: String(row.id),
      groupId: String(row.groupId),
      groupName: row.groupName,
      email: row.email,
      status: 'Accepted',
      emailDeliveryStatus: undefined,
      invitedAt: toIsoString(row.invitedAt),
      acceptedAt: row.acceptedAt ? toIsoString(row.acceptedAt) : toIsoString(new Date()),
    };
  }
  if (row.status === 'Declined') {
    throw appError(ErrorCode.BAD_USER_INPUT, 'This invitation was declined and cannot be accepted.');
  }

  await db.execute(
    `
      UPDATE group_invitations
      SET status = 'Accepted', accepted_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [numericId],
  );

  const viewerUserId = parseViewerUserId(viewer.userId);
  await db.execute(
    `
      UPDATE group_members
      SET user_id = ?
      WHERE group_id = ?
        AND email = ?
        AND user_id IS NULL
    `,
    [viewerUserId, row.groupId, normalizeMemberEmail(row.email)],
  );

  return {
    id: String(row.id),
    groupId: String(row.groupId),
    groupName: row.groupName,
    email: row.email,
    status: 'Accepted',
    emailDeliveryStatus: undefined,
    invitedAt: toIsoString(row.invitedAt),
    acceptedAt: toIsoString(new Date()),
  };
};

export const declineGroupInvitation = async (
  invitationId: string,
  userEmail: string,
): Promise<GroupInvitation> => {
  const numericId = Number(invitationId);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid invitation id.');
  }

  const row = await getInvitationRowForUser(numericId, userEmail);
  if (!row) {
    throw appError(ErrorCode.NOT_FOUND, 'Invitation not found.');
  }
  if (row.status === 'Declined') {
    return {
      id: String(row.id),
      groupId: String(row.groupId),
      groupName: row.groupName,
      email: row.email,
      status: 'Declined',
      emailDeliveryStatus: undefined,
      invitedAt: toIsoString(row.invitedAt),
      acceptedAt: undefined,
    };
  }

  const [memberRows] = await db.query<Array<{ name: string } & RowDataPacket>>(
    `
      SELECT name
      FROM group_members
      WHERE group_id = ? AND email = ?
      LIMIT 1
    `,
    [row.groupId, row.email],
  );
  const memberName = memberRows[0]?.name ?? row.email;

  await db.execute(
    `
      UPDATE group_invitations
      SET status = 'Declined', accepted_at = NULL
      WHERE id = ?
    `,
    [numericId],
  );
  await removeMemberFromHousehold(row.groupId, row.email, memberName);

  return {
    id: String(row.id),
    groupId: String(row.groupId),
    groupName: row.groupName,
    email: row.email,
    status: 'Declined',
    emailDeliveryStatus: undefined,
    invitedAt: toIsoString(row.invitedAt),
    acceptedAt: undefined,
  };
};

export const declineExpenseGroupParticipation = async (
  groupId: string,
  category: string,
  viewer: GroupViewer,
): Promise<boolean> => {
  const numericGroupId = Number(groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid group id.');
  }
  const normalizedCategory = category.trim();
  if (!normalizedCategory) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Expense group category is required.');
  }

  await assertActiveGroupMembership(numericGroupId, viewer, 'declineExpenseGroupParticipation');

  const memberName = await loadViewerGroupMemberName(numericGroupId, viewer);
  if (!memberName) {
    throw appError(ErrorCode.FORBIDDEN, 'Not a member of this household.');
  }

  const [templateRows] = await db.query<Array<{ id: number; splitDetails: string } & RowDataPacket>>(
    `
      SELECT id, split_details AS splitDetails
      FROM group_split_templates
      WHERE group_id = ? AND category = ?
      LIMIT 1
    `,
    [numericGroupId, normalizedCategory],
  );
  const template = templateRows[0];
  if (!template) {
    throw appError(ErrorCode.NOT_FOUND, 'Expense group not found.');
  }

  const splitDetailsJson = stripParticipantFromTemplateSplitJson(
    typeof template.splitDetails === 'string' ? template.splitDetails : '[]',
    memberName,
  );

  const [updateResult] = await db.execute<ResultSetHeader>(
    `
      UPDATE group_split_templates
      SET split_details = ?
      WHERE id = ?
    `,
    [splitDetailsJson, template.id],
  );

  return updateResult.affectedRows > 0;
};

export const resendGroupInvitation = async (
  groupId: string,
  inviteeEmail: string,
  actor: GroupViewer,
): Promise<GroupPendingInvitation> => {
  const numericGroupId = Number(groupId);
  if (!Number.isFinite(numericGroupId) || numericGroupId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid group id.');
  }
  const normalizedEmail = inviteeEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invitee email is required.');
  }

  await assertActiveGroupMembership(numericGroupId, actor, 'resend_group_invitation');

  const normalizedActorEmail = normalizeMemberEmail(actor.email);
  if (normalizedEmail === normalizedActorEmail) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Cannot resend an invitation to yourself.');
  }

  const [invitationRows] = await db.query<
    Array<{ status: string; emailDeliveryStatus: string | null } & RowDataPacket>
  >(
    `
      SELECT status, email_delivery_status AS emailDeliveryStatus
      FROM group_invitations
      WHERE group_id = ?
        AND email = ?
      LIMIT 1
    `,
    [numericGroupId, normalizedEmail],
  );
  const invitation = invitationRows[0];
  if (!invitation) {
    throw appError(ErrorCode.NOT_FOUND, 'Pending invitation not found.');
  }
  if (invitation.status !== 'Pending') {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Only pending invitations can be resent.');
  }

  const [memberRows] = await db.query<Array<{ name: string } & RowDataPacket>>(
    `
      SELECT name
      FROM group_members
      WHERE group_id = ?
        AND email = ?
      LIMIT 1
    `,
    [numericGroupId, normalizedEmail],
  );
  const memberName = memberRows[0]?.name;
  if (!memberName) {
    throw appError(ErrorCode.NOT_FOUND, 'Invitee is not a member of this household.');
  }

  const [groupRows] = await db.query<Array<{ name: string } & RowDataPacket>>(
    `
      SELECT name
      FROM \`groups\`
      WHERE id = ?
      LIMIT 1
    `,
    [numericGroupId],
  );
  const groupName = groupRows[0]?.name;
  if (!groupName) {
    throw appError(ErrorCode.NOT_FOUND, 'Group not found.');
  }

  const [userRows] = await db.query<RowDataPacket[]>(
    `
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [normalizedEmail],
  );

  await updateInvitationEmailDeliveryStatus(numericGroupId, normalizedEmail, 'pending_email');

  await sendHouseholdMemberInviteEmails({
    groupId: numericGroupId,
    groupName,
    actorEmail: normalizedActorEmail,
    targets: [
      {
        email: normalizedEmail,
        name: memberName,
        hasAccount: userRows.length > 0,
      },
    ],
  });

  const [statusRows] = await db.query<Array<{ emailDeliveryStatus: string | null } & RowDataPacket>>(
    `
      SELECT email_delivery_status AS emailDeliveryStatus
      FROM group_invitations
      WHERE group_id = ?
        AND email = ?
      LIMIT 1
    `,
    [numericGroupId, normalizedEmail],
  );

  return {
    email: normalizedEmail,
    name: memberName,
    status: 'Pending',
    emailDeliveryStatus: mapInvitationEmailDeliveryStatus(statusRows[0]?.emailDeliveryStatus),
  };
};
