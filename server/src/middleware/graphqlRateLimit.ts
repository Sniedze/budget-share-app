import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';

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
  windowMs: 15 * 60 * 1000,
  limit: (req) => (isStrictAuthGraphqlOperation(req) ? 100 : 800),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      errors: [{ message: 'Too many requests. Try again later.' }],
    });
  },
});
