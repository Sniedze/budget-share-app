import type { NextFunction, Request, Response } from 'express';
import { logServerError } from '../logger.js';
import { getRequestId } from './requestContext.js';

type HttpError = Error & { status?: number; statusCode?: number; type?: string };

const clampHttpStatus = (raw: number): number => {
  if (!Number.isFinite(raw)) {
    return 500;
  }
  const truncated = Math.trunc(raw);
  if (truncated < 400 || truncated > 599) {
    return 500;
  }
  return truncated;
};

export const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const safeStatus = clampHttpStatus(Number(err.statusCode ?? err.status ?? 500));
  const requestId = getRequestId(res);

  logServerError({
    requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: safeStatus,
    message: err.message,
  });

  if (res.headersSent) {
    return;
  }

  const message = safeStatus === 500 ? 'Internal server error.' : err.message;
  res.status(safeStatus).json({
    errors: [{ message }],
    requestId,
  });
};
