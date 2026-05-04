import type { NextFunction, Request, Response } from 'express';
import { getAllowedOrigins } from '../config/corsOptions.js';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '../modules/auth/cookies.js';

const getCookieValue = (rawCookieHeader: string | undefined, key: string): string | null => {
  if (!rawCookieHeader) {
    return null;
  }
  for (const part of rawCookieHeader.split(';')) {
    const [name, ...rest] = part.split('=');
    if (!name || rest.length === 0) {
      continue;
    }
    if (name.trim() === key) {
      const value = rest.join('=').trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
};

const hasSessionAuthCookie = (req: Request): boolean => {
  const cookie = req.headers.cookie;
  if (!cookie) {
    return false;
  }
  return Boolean(getCookieValue(cookie, ACCESS_COOKIE_NAME) || getCookieValue(cookie, REFRESH_COOKIE_NAME));
};

const isGraphqlMutation = (req: Request): boolean => {
  if (req.method === 'OPTIONS') {
    return false;
  }
  const body = req.body as { query?: unknown } | undefined;
  if (!body || typeof body.query !== 'string') {
    return false;
  }
  return /\bmutation\b/i.test(body.query);
};

const getOriginFromHeaders = (req: Request): string | null => {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.trim().length > 0) {
    return origin.trim();
  }

  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.trim().length > 0) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
};

export const graphqlCsrfGuard = (req: Request, res: Response, next: NextFunction): void => {
  if (!isGraphqlMutation(req) || !hasSessionAuthCookie(req)) {
    next();
    return;
  }

  const origin = getOriginFromHeaders(req);
  const allowedOrigins = new Set(getAllowedOrigins());
  if (origin && allowedOrigins.has(origin)) {
    next();
    return;
  }

  res.status(403).json({
    errors: [{ message: 'CSRF validation failed for cookie-authenticated mutation.' }],
  });
};
