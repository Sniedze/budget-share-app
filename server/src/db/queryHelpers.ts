import type { RowDataPacket } from 'mysql2';
import { db } from './mysql.js';

/**
 * Helper for common "SELECT ... LIMIT 1" patterns.
 * Keeps modules concise while still using mysql2 parameterized queries.
 */
export const queryOne = async <T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> => {
  const [rows] = await db.query<T[]>(sql, params);
  return rows[0] ?? null;
};

/**
 * Helper for common "SELECT ..." patterns.
 */
export const queryMany = async <T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const [rows] = await db.query<T[]>(sql, params);
  return rows;
};
