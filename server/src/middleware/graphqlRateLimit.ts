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

/**
 * Limits abuse of the single GraphQL HTTP endpoint. Login/register get a
 * tighter per-IP budget; everything else (including refreshSession) uses a
 * higher cap for normal SPA usage.
 */
export const graphqlRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  limit: (req) => (isStrictAuthGraphqlOperation(req) ? AUTH_RATE_LIMIT : GENERAL_RATE_LIMIT),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      errors: [{ message: 'Too many requests. Try again later.' }],
    });
  },
});
