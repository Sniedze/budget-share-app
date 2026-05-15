import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../../db/mysql.js';
import { queryOne } from '../../db/queryHelpers.js';
import { REFRESH_TOKEN_TTL_SECONDS } from './jwt.js';

type SessionRow = {
  id: string;
  user_id: number;
} & RowDataPacket;

const sessionTtlSeconds = (): number => REFRESH_TOKEN_TTL_SECONDS;

export const createRefreshSession = async (userId: string): Promise<string> => {
  const sessionId = randomUUID();
  const ttl = sessionTtlSeconds();
  await purgeExpiredSessions();
  await db.execute(
    `
      INSERT INTO user_refresh_sessions (id, user_id, expires_at)
      VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
    `,
    [sessionId, Number(userId), ttl],
  );
  return sessionId;
};

export const touchRefreshSession = async (sessionId: string, userId: string): Promise<boolean> => {
  const ttl = sessionTtlSeconds();
  const [result] = await db.execute<ResultSetHeader>(
    `
      UPDATE user_refresh_sessions
      SET
        last_used_at = CURRENT_TIMESTAMP,
        expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
      WHERE id = ? AND user_id = ? AND expires_at > NOW()
    `,
    [ttl, sessionId, Number(userId)],
  );
  if (result.affectedRows === 0) {
    return false;
  }
  return true;
};

export const isRefreshSessionActive = async (sessionId: string, userId: string): Promise<boolean> => {
  const row = await queryOne<SessionRow>(
    `
      SELECT id, user_id
      FROM user_refresh_sessions
      WHERE id = ? AND user_id = ? AND expires_at > NOW()
      LIMIT 1
    `,
    [sessionId, Number(userId)],
  );
  return Boolean(row);
};

export const revokeRefreshSession = async (sessionId: string, userId: string): Promise<void> => {
  await db.execute(
    `
      DELETE FROM user_refresh_sessions
      WHERE id = ? AND user_id = ?
    `,
    [sessionId, Number(userId)],
  );
};

export const revokeAllRefreshSessions = async (userId: string): Promise<void> => {
  await db.execute(
    `
      DELETE FROM user_refresh_sessions
      WHERE user_id = ?
    `,
    [Number(userId)],
  );
};

const purgeExpiredSessions = async (): Promise<void> => {
  await db.execute(
    `
      DELETE FROM user_refresh_sessions
      WHERE expires_at <= NOW()
    `,
  );
};
