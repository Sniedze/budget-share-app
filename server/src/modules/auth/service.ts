import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { db } from '../../db/mysql.js';
import { queryOne } from '../../db/queryHelpers.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt.js';
import type { AuthPayload, ChangePasswordInput, LoginInput, RegisterInput, User } from './types.js';
import { appError, ErrorCode } from '../../graphql/appError.js';
import {
  assertCurrentPasswordForChange,
  assertPasswordAcceptableForRegister,
  assertPasswordLengthForLogin,
  assertPasswordStrength,
  normalizeFullNameForRegister,
  stripControlCharacters,
  validateEmailFormat,
} from './validation.js';
import {
  createRefreshSession,
  isRefreshSessionActive,
  revokeAllRefreshSessions,
  revokeRefreshSession,
  touchRefreshSession,
} from './refreshSessions.js';

const SALT_ROUNDS = 12;

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  password_hash: string;
  created_at: string;
  refresh_token_version: number;
} & RowDataPacket;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toUser = (row: UserRow): User => ({
  id: String(row.id),
  email: row.email,
  fullName: row.full_name,
  createdAt: row.created_at,
});

const issueAuthPayload = async (row: UserRow, sessionId: string): Promise<AuthPayload> => {
  const user = toUser(row);
  const version = Number(row.refresh_token_version) || 0;
  return {
    accessToken: signAccessToken(user.id, user.email),
    refreshToken: signRefreshToken(user.id, user.email, version, sessionId),
    user,
  };
};

const getUserByEmail = async (email: string): Promise<UserRow | null> => {
  return queryOne<UserRow>(
    `
      SELECT id, email, full_name, password_hash, created_at, refresh_token_version
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );
};

export const register = async (input: RegisterInput): Promise<AuthPayload> => {
  const email = normalizeEmail(stripControlCharacters(input.email));
  validateEmailFormat(email, 'register');
  const fullName = normalizeFullNameForRegister(input.fullName);
  const password = input.password;
  assertPasswordAcceptableForRegister(password);

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw appError(ErrorCode.CONFLICT, 'Email already in use.');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [insertResult] = await db.execute<ResultSetHeader>(
    `
      INSERT INTO users (email, full_name, password_hash)
      VALUES (?, ?, ?)
    `,
    [email, fullName, passwordHash],
  );

  const userRow = await queryOne<UserRow>(
    `
      SELECT id, email, full_name, password_hash, created_at, refresh_token_version
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [insertResult.insertId],
  );
  if (!userRow) {
    throw appError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to load created user.');
  }

  await db.execute(
    `
      UPDATE group_invitations
      SET status = 'Accepted', accepted_at = CURRENT_TIMESTAMP
      WHERE email = ? AND status = 'Pending'
    `,
    [email],
  );

  const sessionId = await createRefreshSession(String(userRow.id));
  return issueAuthPayload(userRow, sessionId);
};

export const login = async (input: LoginInput): Promise<AuthPayload> => {
  const email = normalizeEmail(stripControlCharacters(input.email));
  validateEmailFormat(email, 'login');
  assertPasswordLengthForLogin(input.password);
  const user = await getUserByEmail(email);
  if (!user) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid email or password.');
  }

  const isValidPassword = await bcrypt.compare(input.password, user.password_hash);
  if (!isValidPassword) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid email or password.');
  }

  const sessionId = await createRefreshSession(String(user.id));
  return issueAuthPayload(user, sessionId);
};

const assertRefreshTokenUsable = async (
  claims: NonNullable<ReturnType<typeof verifyRefreshToken>>,
  user: UserRow,
): Promise<string> => {
  const version = Number(user.refresh_token_version) || 0;
  if (claims.rtv !== version) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid refresh token.');
  }

  const sessionId = claims.sid?.trim();
  if (!sessionId) {
    return createRefreshSession(String(user.id));
  }

  const active = await isRefreshSessionActive(sessionId, String(user.id));
  if (!active) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid refresh token.');
  }

  const touched = await touchRefreshSession(sessionId, String(user.id));
  if (!touched) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid refresh token.');
  }
  return sessionId;
};

export const refreshSession = async (refreshToken: string): Promise<AuthPayload> => {
  const claims = verifyRefreshToken(refreshToken);
  if (!claims) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Invalid refresh token.');
  }

  const user = await queryOne<UserRow>(
    `
      SELECT id, email, full_name, password_hash, created_at, refresh_token_version
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [claims.userId],
  );
  if (!user) {
    throw appError(ErrorCode.NOT_FOUND, 'User not found.');
  }

  const sessionId = await assertRefreshTokenUsable(claims, user);
  return issueAuthPayload(user, sessionId);
};

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
): Promise<AuthPayload> => {
  assertCurrentPasswordForChange(input.currentPassword);
  assertPasswordStrength(input.newPassword);

  const user = await queryOne<UserRow>(
    `
      SELECT id, email, full_name, password_hash, created_at, refresh_token_version
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  if (!user) {
    throw appError(ErrorCode.NOT_FOUND, 'User not found.');
  }

  const currentValid = await bcrypt.compare(input.currentPassword, user.password_hash);
  if (!currentValid) {
    throw appError(ErrorCode.UNAUTHENTICATED, 'Current password is incorrect.');
  }

  const reusingPassword = await bcrypt.compare(input.newPassword, user.password_hash);
  if (reusingPassword) {
    throw appError(ErrorCode.BAD_USER_INPUT, 'New password must be different from your current password.');
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  await db.execute(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, userId],
  );

  await revokeRefreshTokens(userId);

  const updatedUser = await queryOne<UserRow>(
    `
      SELECT id, email, full_name, password_hash, created_at, refresh_token_version
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  if (!updatedUser) {
    throw appError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to load user after password change.');
  }

  const sessionId = await createRefreshSession(userId);
  return issueAuthPayload(updatedUser, sessionId);
};

/** Revokes only the refresh session tied to the given token (current device). */
export const logoutSession = async (refreshToken: string | null | undefined): Promise<void> => {
  if (!refreshToken?.trim()) {
    return;
  }

  const claims = verifyRefreshToken(refreshToken);
  if (!claims?.sid?.trim()) {
    return;
  }

  await revokeRefreshSession(claims.sid.trim(), claims.userId);
};

/** Invalidates every refresh session for the user (password change, account compromise). */
export const revokeRefreshTokens = async (userId: string): Promise<void> => {
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

export const getUserById = async (userId: string): Promise<User | null> => {
  const row = await queryOne<UserRow>(
    `
      SELECT id, email, full_name, password_hash, created_at, refresh_token_version
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  return row ? toUser(row) : null;
};
