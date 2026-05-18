import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_AUTH_RATE_LIMIT = 100;
const DEFAULT_SESSION_AUTH_RATE_LIMIT = 60;
const DEFAULT_GENERAL_RATE_LIMIT = 800;

const parsePositiveInteger = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const AUTH_RATE_LIMIT = parsePositiveInteger(process.env.GRAPHQL_RATE_LIMIT_AUTH, DEFAULT_AUTH_RATE_LIMIT);
const SESSION_AUTH_RATE_LIMIT = parsePositiveInteger(
  process.env.GRAPHQL_RATE_LIMIT_SESSION,
  DEFAULT_SESSION_AUTH_RATE_LIMIT,
);
const GENERAL_RATE_LIMIT = parsePositiveInteger(process.env.GRAPHQL_RATE_LIMIT_GENERAL, DEFAULT_GENERAL_RATE_LIMIT);

const matchesGraphqlOperation = (req: Request, operationNames: string[]): boolean => {
  if (req.method === 'OPTIONS') {
    return false;
  }
  const body = req.body as { operationName?: string; query?: string } | undefined;
  if (!body) {
    return false;
  }
  if (typeof body.operationName === 'string') {
    const op = body.operationName.trim().toLowerCase();
    return operationNames.some((name) => op === name.toLowerCase());
  }
  if (typeof body.query === 'string') {
    const q = body.query;
    if (!/\bmutation\b/i.test(q)) {
      return false;
    }
    return operationNames.some((name) => new RegExp(`\\b${name}\\s*\\(`, 'i').test(q));
  }
  return false;
};

/** Login/register brute-force protection. */
const isStrictAuthGraphqlOperation = (req: Request): boolean =>
  matchesGraphqlOperation(req, ['Login', 'Register']);

/** Password change and token refresh — tighter per-IP cap than general API traffic. */
const isSessionSensitiveGraphqlOperation = (req: Request): boolean => {
  if (matchesGraphqlOperation(req, ['ChangePassword', 'RefreshSession', 'DeleteAccount'])) {
    return true;
  }
  if (req.method === 'OPTIONS') {
    return false;
  }
  const body = req.body as { operationName?: string; query?: string } | undefined;
  if (!body) {
    return false;
  }
  if (typeof body.operationName === 'string' && body.operationName.trim().toLowerCase() === 'exportmydata') {
    return true;
  }
  if (typeof body.query === 'string' && /\bquery\b/i.test(body.query) && /\bexportMyData\b/i.test(body.query)) {
    return true;
  }
  return false;
};

const normalizeRateLimitEmail = (raw: unknown): string | null => {
  if (typeof raw !== 'string') {
    return null;
  }
  const email = raw.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) {
    return null;
  }
  return email;
};

/** Prefer per-email keys for login/register so distributed IPs cannot bypass IP caps. */
export const extractLoginRegisterEmail = (req: Request): string | null => {
  const body = req.body as
    | {
        variables?: { input?: { email?: unknown } };
        query?: string;
      }
    | undefined;
  if (!body) {
    return null;
  }

  const fromVariables = normalizeRateLimitEmail(body.variables?.input?.email);
  if (fromVariables) {
    return fromVariables;
  }

  if (typeof body.query !== 'string') {
    return null;
  }

  const match = body.query.match(/email\s*:\s*"([^"]+)"/i);
  return match ? normalizeRateLimitEmail(match[1]) : null;
};

const rateLimitKey = (req: Request): string => {
  if (isStrictAuthGraphqlOperation(req)) {
    const email = extractLoginRegisterEmail(req);
    if (email) {
      return `auth-email:${email}`;
    }
  }
  if (isSessionSensitiveGraphqlOperation(req)) {
    return `session-auth:${req.ip ?? 'unknown'}`;
  }
  return req.ip ?? 'unknown';
};

/** Exported for unit tests. */
export const resolveGraphqlRateLimit = (req: Request): number => {
  if (isStrictAuthGraphqlOperation(req)) {
    return AUTH_RATE_LIMIT;
  }
  if (isSessionSensitiveGraphqlOperation(req)) {
    return SESSION_AUTH_RATE_LIMIT;
  }
  return GENERAL_RATE_LIMIT;
};

/**
 * Limits abuse of the single GraphQL HTTP endpoint. Login/register use a
 * per-email budget; change-password and refresh-session use a per-IP cap.
 */
export const graphqlRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: (req) => resolveGraphqlRateLimit(req),
  keyGenerator: rateLimitKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      errors: [{ message: 'Too many requests. Try again later.' }],
    });
  },
});
