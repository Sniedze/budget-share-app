import bcrypt from 'bcryptjs';
import { db } from '../src/db/mysql.js';
import { queryOne } from '../src/db/queryHelpers.js';
import type { RowDataPacket } from 'mysql2';
import { AppError, ErrorCode } from '../src/graphql/appError.js';
import { register } from '../src/modules/auth/service.js';
import { login } from '../src/modules/auth/service.js';
import { normalizeFullNameForRegister } from '../src/modules/auth/validation.js';

const SALT_ROUNDS = 12;

type UserRow = { id: number; email: string } & RowDataPacket;

export const ensureUserAccount = async (input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<string> => {
  const email = input.email.trim().toLowerCase();
  const fullName = normalizeFullNameForRegister(input.fullName);
  const existing = await queryOne<UserRow>('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);

  if (existing) {
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    await db.execute('UPDATE users SET password_hash = ?, full_name = ? WHERE id = ?', [
      passwordHash,
      fullName,
      existing.id,
    ]);
    return String(existing.id);
  }

  try {
    const payload = await register({ email, password: input.password, fullName });
    return payload.user.id;
  } catch (error) {
    if (error instanceof AppError && error.extensions?.code === ErrorCode.CONFLICT) {
      return ensureUserAccount(input);
    }
    throw error;
  }
};

export const verifyUserLogin = async (email: string, password: string): Promise<void> => {
  await login({ email, password });
};
