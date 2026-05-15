import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_AUTH_RATE_LIMIT = 100;
const DEFAULT_GENERAL_RATE_LIMIT = 800;

const parsePositiveInteger = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
};

const AUTH_RATE_LIMIT = parsePositiveInteger(process.env.GRAPHQL_RATE_LIMIT_AUTH, DEFAULT_AUTH_RATE_LIMIT);
const GENERAL_RATE_LIMIT = parsePositiveInteger(process.env.GRAPHQL_RATE_LIMIT_GENERAL, DEFAULT_GENERAL_RATE_LIMIT);

/**
 * Strict cap: login/register brute-force protection only.
 * RefreshSession is excluded — it shares the generous default budget so token
 * refresh + many API calls do not burn the same small bucket as credential tries.
 */
const isStrictAuthGraphqlOperation = (req: Request): boolean => {
  if (req.method === 'OPTIONS') {
    return false;
  }
  const body = req.body as { operationName?: string; query?: string } | undefined;
  if (!body) {
    return false;
  }
  if (typeof body.operationName === 'string') {
    if (/^(Login|Register)$/i.test(body.operationName.trim())) {
      return true;
    }
  }
  if (typeof body.query === 'string') {
    const q = body.query;
    if (/\bmutation\b/i.test(q) && /\b(login|register)\s*\(/i.test(q)) {
      return true;
    }
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
  return req.ip ?? 'unknown';
};

/**
 * Limits abuse of the single GraphQL HTTP endpoint. Login/register get a
 * tighter per-email budget (fallback per-IP when email is missing); everything
 * else (including refreshSession) uses a higher cap for normal SPA usage.
 */
export const graphqlRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: (req) => (isStrictAuthGraphqlOperation(req) ? AUTH_RATE_LIMIT : GENERAL_RATE_LIMIT),
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
