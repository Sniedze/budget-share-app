import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { assignRequestContext, getRequestId, REQUEST_ID_HEADER } from './requestContext.js';

type FinishHandler = () => void;

const createRes = (): Response & {
  finishHandler?: FinishHandler;
  locals: Record<string, unknown>;
  headers: Record<string, string>;
} => {
  const res = {
    locals: {},
    headers: {},
    statusCode: 200,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    on(event: string, handler: FinishHandler) {
      if (event === 'finish') {
        this.finishHandler = handler;
      }
      return this;
    },
  } as Response & {
    finishHandler?: FinishHandler;
    locals: Record<string, unknown>;
    headers: Record<string, string>;
  };

  return res;
};

describe('requestContext middleware', () => {
  it('preserves incoming x-request-id header', () => {
    const req = {
      method: 'POST',
      originalUrl: '/graphql',
      headers: { [REQUEST_ID_HEADER]: 'req-123' },
    } as unknown as Request;
    const res = createRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };

    assignRequestContext(req, res, next);

    assert.equal(called, true);
    assert.equal(getRequestId(res), 'req-123');
    assert.equal(res.headers[REQUEST_ID_HEADER], 'req-123');
    res.finishHandler?.();
  });

  it('generates request id when header is missing', () => {
    const req = {
      method: 'GET',
      originalUrl: '/health',
      headers: {},
    } as unknown as Request;
    const res = createRes();

    assignRequestContext(req, res, () => undefined);

    const generated = getRequestId(res);
    assert.ok(generated.length > 0);
    assert.equal(res.headers[REQUEST_ID_HEADER], generated);
    res.finishHandler?.();
  });
});
