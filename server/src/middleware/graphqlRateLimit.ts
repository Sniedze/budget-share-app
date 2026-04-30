import type { Request } from 'express';
import { rateLimit } from 'express-rate-limit';

const isAuthGraphqlOperation = (req: Request): boolean => {
  if (req.method === 'OPTIONS') {
    return false;
  }
  const body = req.body as { operationName?: string; query?: string } | undefined;
  if (!body) {
    return false;
  }
  if (typeof body.operationName === 'string') {
    if (/^(Login|Register|RefreshSession)$/i.test(body.operationName.trim())) {
      return true;
    }
  }
  if (typeof body.query === 'string') {
    const q = body.query;
    if (/\bmutation\b/i.test(q) && /\b(login|register|refreshSession)\s*\(/i.test(q)) {
      return true;
    }
  }
  return false;
};

/**
 * Limits abuse of the single GraphQL HTTP endpoint. Auth mutations get a
 * tighter per-IP budget; other operations get a higher cap for normal SPA usage.
 */
export const graphqlRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: (req) => (isAuthGraphqlOperation(req) ? 40 : 800),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      errors: [{ message: 'Too many requests. Try again later.' }],
    });
  },
});
