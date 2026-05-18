import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { db } from '../../db/mysql.js';
import { queryOne } from '../../db/queryHelpers.js';
import { appError, ErrorCode } from '../../graphql/appError.js';
import { logAuditEvent } from '../audit/service.js';
import { listExpenses } from '../expenses/service.js';
import { listGroups, listInvitations, listHouseholdSettlements } from '../groups/service.js';
import { listAllUserSettings } from '../userSettings/service.js';
import { validateDeleteAccountConfirmation } from './accountDataValidation.js';
import { assertCurrentPasswordForChange } from './validation.js';
import { getUserById } from './service.js';
import type { DeleteAccountInput, UserDataExport } from './types.js';

const EXPORT_FORMAT = 'json';
const EXPORT_VERSION = 1;

type UserRow = {
  id: number;
  email: string;
  password_hash: string;
} & RowDataPacket;

export const exportMyData = async (userId: string, userEmail: string): Promise<UserDataExport> => {
  const user = await getUserById(userId);
  if (!user) {
    throw appError(ErrorCode.NOT_FOUND, 'User not found.');
  }

  const viewer = { userId, email: userEmail };
  const [expenses, households, invitations, workspaceSettings, householdSettlements] = await Promise.all([
    listExpenses(userId, userEmail),
    listGroups(viewer),
    listInvitations(viewer),
    listAllUserSettings(Number(userId)),
    listHouseholdSettlements(viewer),
  ]);

  const exportedAt = new Date().toISOString();
  const payload = {
    exportVersion: EXPORT_VERSION,
    exportedAt,
    account: user,
    expenses,
    households,
    invitations,
    workspaceSettings,
    householdSettlements,
  };

  return {
    exportedAt,
    format: EXPORT_FORMAT,
    data: JSON.stringify(payload, null, 2),
  };
};

export const deleteAccount = async (userId: string, input: DeleteAccountInput): Promise<void> => {
  assertCurrentPasswordForChange(input.password);
  validateDeleteAccountConfirmation(input.confirmation);

  const numericUserId = Number(userId);
  if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'Invalid user.');
  }

  const user = await queryOne<UserRow>(
    `
      SELECT id, email, password_hash
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [numericUserId],
  );
  if (!user) {
    throw appError(ErrorCode.NOT_FOUND, 'User not found.');
  }

  const passwordValid = await bcrypt.compare(input.password, user.password_hash);
  if (!passwordValid) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Password is incorrect.');
  }

  const normalizedEmail = user.email.trim().toLowerCase();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute<ResultSetHeader>(
      'DELETE FROM expenses WHERE group_id IS NULL AND created_by_user_id = ?',
      [numericUserId],
    );
    await connection.execute(
      'UPDATE expenses SET created_by_user_id = NULL WHERE created_by_user_id = ?',
      [numericUserId],
    );
    await connection.execute(
      'UPDATE expenses SET paid_by_user_id = NULL WHERE paid_by_user_id = ?',
      [numericUserId],
    );
    await connection.execute('DELETE FROM group_members WHERE user_id = ?', [numericUserId]);
    await connection.execute(
      `
        DELETE FROM group_invitations
        WHERE invited_user_id = ?
           OR LOWER(TRIM(email)) = ?
      `,
      [numericUserId, normalizedEmail],
    );
    await connection.execute(
      `
        UPDATE audit_logs
        SET actor_email = ?
        WHERE actor_user_id = ?
      `,
      ['[deleted account]', numericUserId],
    );

    await connection.execute('DELETE FROM users WHERE id = ?', [numericUserId]);
    await connection.commit();

    await logAuditEvent({
      actorUserId: userId,
      actorEmail: normalizedEmail,
      action: 'account.deleted',
      entityType: 'user',
      entityId: userId,
      metadata: { email: normalizedEmail },
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};
