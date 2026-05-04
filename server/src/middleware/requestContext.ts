import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { logRequestCompleted } from '../logger.js';

export const REQUEST_ID_HEADER = 'x-request-id';

export const assignRequestContext = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim() : randomUUID();

  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    logRequestCompleted({
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
};

export const getRequestId = (res: Response): string => {
  const raw = res.locals.requestId;
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }
  return 'unknown';
};
