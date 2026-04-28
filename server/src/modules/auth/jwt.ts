import jwt from 'jsonwebtoken';

type TokenClaims = {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
};

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_access_secret_change_me';
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';
const parseTtlSeconds = (rawValue: string | undefined, fallbackSeconds: number): number => {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackSeconds;
};
const ACCESS_TOKEN_TTL_SECONDS = parseTtlSeconds(process.env.JWT_ACCESS_TTL_SECONDS, 15 * 60);
const REFRESH_TOKEN_TTL_SECONDS = parseTtlSeconds(process.env.JWT_REFRESH_TTL_SECONDS, 7 * 24 * 60 * 60);

export const signAccessToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email, type: 'access' }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
};

export const signRefreshToken = (userId: string, email: string): string => {
  return jwt.sign({ userId, email, type: 'refresh' }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL_SECONDS });
};

const verifyWithSecret = (token: string, secret: string): TokenClaims | null => {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== 'object' || !decoded || !('userId' in decoded) || !('email' in decoded) || !('type' in decoded)) {
      return null;
    }
    const claims = decoded as TokenClaims;
    if (claims.type !== 'access' && claims.type !== 'refresh') {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
};

export const verifyAccessToken = (token: string): TokenClaims | null => {
  const claims = verifyWithSecret(token, ACCESS_TOKEN_SECRET);
  if (!claims || claims.type !== 'access') {
    return null;
  }
  return claims;
};

export const verifyRefreshToken = (token: string): TokenClaims | null => {
  const claims = verifyWithSecret(token, REFRESH_TOKEN_SECRET);
  if (!claims || claims.type !== 'refresh') {
    return null;
  }
  return claims;
};
