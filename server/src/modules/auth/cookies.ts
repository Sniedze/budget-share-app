import type { Request, Response } from 'express';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './jwt.js';

export const ACCESS_COOKIE_NAME = process.env.AUTH_ACCESS_COOKIE_NAME ?? 'budgetshare_access';
export const REFRESH_COOKIE_NAME = process.env.AUTH_REFRESH_COOKIE_NAME ?? 'budgetshare_refresh';

/** Cookies are scoped to the GraphQL path so they are not sent to /health. */
const COOKIE_PATH = '/graphql';

const baseCookieFlags = (): string => {
  const secure = process.env.NODE_ENV === 'production';
  return `Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
};

const parseCookieHeader = (header: string | undefined): Record<string, string> => {
  if (!header || header.length === 0) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) {
      out[key] = decodeURIComponent(value);
    }
  }
  return out;
};

export const getAccessTokenFromCookies = (req: Request): string | null => {
  const raw = parseCookieHeader(req.headers.cookie)[ACCESS_COOKIE_NAME];
  return raw && raw.length > 0 ? raw : null;
};

export const getRefreshTokenFromCookies = (req: Request): string | null => {
  const raw = parseCookieHeader(req.headers.cookie)[REFRESH_COOKIE_NAME];
  return raw && raw.length > 0 ? raw : null;
};

export type SessionCookieOptions = {
  remember: boolean;
};

export const setSessionCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
  options: SessionCookieOptions,
): void => {
  const flags = baseCookieFlags();
  const accessMaxAge = ACCESS_TOKEN_TTL_SECONDS;
  const refreshMaxAge = options.remember ? REFRESH_TOKEN_TTL_SECONDS : undefined;

  res.appendHeader(
    'Set-Cookie',
    `${ACCESS_COOKIE_NAME}=${encodeURIComponent(accessToken)}; ${flags}; Max-Age=${accessMaxAge}`,
  );
  if (refreshMaxAge !== undefined) {
    res.appendHeader(
      'Set-Cookie',
      `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}; ${flags}; Max-Age=${refreshMaxAge}`,
    );
  } else {
    res.appendHeader(
      'Set-Cookie',
      `${REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}; ${flags}`,
    );
  }
};

export const clearSessionCookies = (res: Response): void => {
  const flags = baseCookieFlags();
  res.appendHeader('Set-Cookie', `${ACCESS_COOKIE_NAME}=; ${flags}; Max-Age=0`);
  res.appendHeader('Set-Cookie', `${REFRESH_COOKIE_NAME}=; ${flags}; Max-Age=0`);
};
