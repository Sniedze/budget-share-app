import jwt from 'jsonwebtoken';

type AccessTokenClaims = {
  userId: string;
  email: string;
  type: 'access';
};

export type RefreshTokenClaims = {
  userId: string;
  email: string;
  type: 'refresh';
  rtv: number;
};

const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

const getRequiredSecret = (envName: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET', devFallback: string): string => {
  const value = process.env[envName];
  if (value && value.trim().length > 0) {
    return value;
  }
  if (isDevelopment) {
    return devFallback;
  }
  throw new Error(`${envName} must be set in non-development environments.`);
};

const ACCESS_TOKEN_SECRET = getRequiredSecret('JWT_ACCESS_SECRET', 'dev_access_secret_change_me');
const REFRESH_TOKEN_SECRET = getRequiredSecret('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me');
const parseTtlSeconds = (rawValue: string | undefined, fallbackSeconds: number): number => {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackSeconds;
};

export const ACCESS_TOKEN_TTL_SECONDS = parseTtlSeconds(process.env.JWT_ACCESS_TTL_SECONDS, 15 * 60);
export const REFRESH_TOKEN_TTL_SECONDS = parseTtlSeconds(process.env.JWT_REFRESH_TTL_SECONDS, 7 * 24 * 60 * 60);

export const signAccessToken = (userId: string, email: string): string => {
  const payload: AccessTokenClaims = { userId, email, type: 'access' };
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
};

export const signRefreshToken = (userId: string, email: string, refreshTokenVersion: number): string => {
  const payload: RefreshTokenClaims = { userId, email, type: 'refresh', rtv: refreshTokenVersion };
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL_SECONDS });
};

const verifyAccessWithSecret = (token: string, secret: string): AccessTokenClaims | null => {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== 'object' || !decoded || !('userId' in decoded) || !('email' in decoded) || !('type' in decoded)) {
      return null;
    }
    const claims = decoded as AccessTokenClaims;
    if (claims.type !== 'access') {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
};

const verifyRefreshWithSecret = (token: string, secret: string): RefreshTokenClaims | null => {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded !== 'object' || !decoded || !('userId' in decoded) || !('email' in decoded) || !('type' in decoded)) {
      return null;
    }
    const claims = decoded as RefreshTokenClaims;
    if (claims.type !== 'refresh') {
      return null;
    }
    if (typeof claims.rtv !== 'number' || !Number.isFinite(claims.rtv) || claims.rtv < 0) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
};

export const verifyAccessToken = (token: string): AccessTokenClaims | null => {
  return verifyAccessWithSecret(token, ACCESS_TOKEN_SECRET);
};

export const verifyRefreshToken = (token: string): RefreshTokenClaims | null => {
  return verifyRefreshWithSecret(token, REFRESH_TOKEN_SECRET);
};
