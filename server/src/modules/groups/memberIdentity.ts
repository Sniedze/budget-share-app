import type { RowDataPacket } from 'mysql2/promise';
import { db } from '../../db/mysql.js';

/** Viewer identity for group membership checks (prefer user_id, fall back to email). */
export type GroupViewer = {
  userId: string;
  email: string;
};

export const normalizeMemberEmail = (email: string): string => email.trim().toLowerCase();

export const parseViewerUserId = (userId: string): number => {
  const numeric = Number(userId);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid viewer user id: ${userId}`);
  }
  return numeric;
};

/** Binds `user_id = ? OR (user_id IS NULL AND email = ?)` for group_members / gm aliases. */
export const groupMemberMatchesViewerParams = (viewer: GroupViewer): [number, string] => [
  parseViewerUserId(viewer.userId),
  normalizeMemberEmail(viewer.email),
];

export const groupMemberMatchesViewerClause = (alias = 'gm'): string =>
  `(${alias}.user_id = ? OR (${alias}.user_id IS NULL AND ${alias}.email = ?))`;

export const findViewerGroupMember = <T extends { userId?: string; email: string }>(
  members: T[],
  viewer: GroupViewer,
): T | undefined => {
  const normalizedEmail = normalizeMemberEmail(viewer.email);
  const byUserId = members.find((member) => member.userId === viewer.userId);
  if (byUserId) {
    return byUserId;
  }
  return members.find((member) => normalizeMemberEmail(member.email) === normalizedEmail);
};

export const loadUserIdsByEmails = async (emails: string[]): Promise<Map<string, number>> => {
  if (emails.length === 0) {
    return new Map();
  }
  const normalized = [...new Set(emails.map((email) => normalizeMemberEmail(email)))];
  const [rows] = await db.query<Array<{ id: number; email: string } & RowDataPacket>>(
    `
      SELECT id, email
      FROM users
      WHERE email IN (?)
    `,
    [normalized],
  );
  const byEmail = new Map<string, number>();
  for (const row of rows) {
    byEmail.set(normalizeMemberEmail(row.email), row.id);
  }
  return byEmail;
};
