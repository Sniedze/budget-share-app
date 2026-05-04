import type { NextFunction, Request, Response } from 'express';
import { logServerError } from '../logger.js';
import { getRequestId } from './requestContext.js';

type HttpError = Error & { status?: number; statusCode?: number; type?: string };

export const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const statusCode = Number(err.statusCode ?? err.status ?? 500);
  const safeStatus = Number.isFinite(statusCode) && statusCode >= 400 ? statusCode : 500;
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
