import type { RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import { queryOne } from '../../db/queryHelpers.js';
import { appError, ErrorCode } from '../../graphql/appError.js';
import { sendEmailChangeConfirmation } from '../email/sendEmailChangeConfirmation.js';
import { createEmailChangeToken, hashEmailChangeToken } from './emailChangeToken.js';
import { revokeAllRefreshSessions } from './refreshSessions.js';

const revokeRefreshTokens = async (userId: string): Promise<void> => {
  await db.execute(
    `
      UPDATE users
      SET refresh_token_version = refresh_token_version + 1
      WHERE id = ?
    `,
    [userId],
  );
  await revokeAllRefreshSessions(userId);
};

type PendingEmailUserRow = {
  id: number;
  email: string;
  full_name: string;
  pending_email: string | null;
} & RowDataPacket;

const parseTtlHours = (): number => {
  const raw = Number(process.env.EMAIL_CHANGE_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 24;
};

export const assertEmailAvailableForUser = async (
  email: string,
  excludeUserId: string,
): Promise<void> => {
  const conflict = await queryOne<RowDataPacket & { id: number }>(
    `
      SELECT id
      FROM users
      WHERE id != ?
        AND (email = ? OR pending_email = ?)
      LIMIT 1
    `,
    [excludeUserId, email, email],
  );
  if (conflict) {
    throw appError(ErrorCode.CONFLICT, 'Email already in use.');
  }
};

export const clearPendingEmailChange = async (userId: string): Promise<void> => {
  await db.execute(
    `
      UPDATE users
      SET pending_email = NULL,
          email_change_token_hash = NULL,
          email_change_expires_at = NULL
      WHERE id = ?
    `,
    [userId],
  );
};

export const startPendingEmailChange = async (
  userId: string,
  newEmail: string,
  fullName: string,
  currentEmail: string,
): Promise<void> => {
  await assertEmailAvailableForUser(newEmail, userId);

  const token = createEmailChangeToken();
  const tokenHash = hashEmailChangeToken(token);
  const ttlHours = parseTtlHours();

  await db.execute(
    `
      UPDATE users
      SET pending_email = ?,
          email_change_token_hash = ?,
          email_change_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR)
      WHERE id = ?
    `,
    [newEmail, tokenHash, ttlHours, userId],
  );

  try {
    await sendEmailChangeConfirmation({
      fullName,
      currentEmail,
      newEmail,
      token,
    });
  } catch (error) {
    await clearPendingEmailChange(userId);
    const message = error instanceof Error ? error.message : 'Failed to send confirmation email.';
    throw appError(ErrorCode.INTERNAL_SERVER_ERROR, message);
  }
};

const applyEmailChangeForUser = async (user: PendingEmailUserRow): Promise<void> => {
  const pendingEmail = user.pending_email?.trim().toLowerCase();
  if (!pendingEmail) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'No pending email change.');
  }

  const previousEmail = user.email;
  await db.execute(
    `
      UPDATE users
      SET email = ?,
          pending_email = NULL,
          email_change_token_hash = NULL,
          email_change_expires_at = NULL
      WHERE id = ?
    `,
    [pendingEmail, user.id],
  );

  await db.execute(
    `
      UPDATE group_members
      SET email = ?
      WHERE user_id = ?
    `,
    [pendingEmail, user.id],
  );
  await db.execute(
    `
      UPDATE group_invitations
      SET email = ?
      WHERE email = ? AND status = 'Pending'
    `,
    [pendingEmail, previousEmail],
  );

  await revokeRefreshTokens(String(user.id));
};

export const confirmEmailChangeByToken = async (token: string): Promise<string> => {
  const trimmed = token.trim();
  if (trimmed.length < 32) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid or expired confirmation link.');
  }

  const tokenHash = hashEmailChangeToken(trimmed);
  const user = await queryOne<
    PendingEmailUserRow & {
      email_change_expires_at: Date | string | null;
    }
  >(
    `
      SELECT id, email, full_name, pending_email, email_change_expires_at
      FROM users
      WHERE email_change_token_hash = ?
      LIMIT 1
    `,
    [tokenHash],
  );

  if (!user?.pending_email) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid or expired confirmation link.');
  }

  const expiresAt =
    user.email_change_expires_at instanceof Date
      ? user.email_change_expires_at
      : user.email_change_expires_at
        ? new Date(user.email_change_expires_at)
        : null;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'This confirmation link has expired. Request a new one from Account Settings.');
  }

  await applyEmailChangeForUser(user);
  return String(user.id);
};

export const resendPendingEmailChange = async (userId: string): Promise<void> => {
  const user = await queryOne<PendingEmailUserRow>(
    `
      SELECT id, email, full_name, pending_email
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  if (!user?.pending_email) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'No pending email change to resend.');
  }

  await startPendingEmailChange(userId, user.pending_email, user.full_name, user.email);
};
