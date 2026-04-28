import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { db } from '../../db/mysql.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt.js';
import type { AuthPayload, LoginInput, RegisterInput, User } from './types.js';

const SALT_ROUNDS = 12;

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  password_hash: string;
  created_at: string;
} & RowDataPacket;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toUser = (row: UserRow): User => ({
  id: String(row.id),
  email: row.email,
  fullName: row.full_name,
  createdAt: row.created_at,
});

const toAuthPayload = (row: UserRow): AuthPayload => {
  const user = toUser(row);
  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: signRefreshToken(user.id, user.email),
    user,
  };
};

const getUserByEmail = async (email: string): Promise<UserRow | null> => {
  const [rows] = await db.query<UserRow[]>(
    `
      SELECT id, email, full_name, password_hash, created_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );
  return rows[0] ?? null;
};

export const register = async (input: RegisterInput): Promise<AuthPayload> => {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  const password = input.password;

  if (!email) {
    throw new Error('Email is required.');
  }
  if (!fullName) {
    throw new Error('Full name is required.');
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('Email already in use.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [insertResult] = await db.execute<ResultSetHeader>(
    `
      INSERT INTO users (email, full_name, password_hash)
      VALUES (?, ?, ?)
    `,
    [email, fullName, passwordHash],
  );

  const [rows] = await db.query<UserRow[]>(
    `
      SELECT id, email, full_name, password_hash, created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [insertResult.insertId],
  );
  const userRow = rows[0];
  if (!userRow) {
    throw new Error('Failed to load created user.');
  }

  return toAuthPayload(userRow);
};

export const login = async (input: LoginInput): Promise<AuthPayload> => {
  const email = normalizeEmail(input.email);
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password.');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid email or password.');
  }

  return toAuthPayload(user);
};

export const refreshSession = async (refreshToken: string): Promise<AuthPayload> => {
  const claims = verifyRefreshToken(refreshToken);
  if (!claims) {
    throw new Error('Invalid refresh token.');
  }

  const [rows] = await db.query<UserRow[]>(
    `
      SELECT id, email, full_name, password_hash, created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [claims.userId],
  );
  const user = rows[0];
  if (!user) {
    throw new Error('User not found.');
  }

  return toAuthPayload(user);
};

export const getUserById = async (userId: string): Promise<User | null> => {
  const [rows] = await db.query<UserRow[]>(
    `
      SELECT id, email, full_name, password_hash, created_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  const row = rows[0];
  return row ? toUser(row) : null;
};
