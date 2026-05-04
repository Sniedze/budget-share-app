import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { graphqlCsrfGuard } from './graphqlCsrfGuard.js';

const createReq = (overrides: Partial<Request>): Request => {
  return {
    method: 'POST',
    headers: {},
    body: undefined,
    ...overrides,
  } as Request;
};

const createRes = (): Response & {
  statusCodeCaptured?: number;
  payload?: unknown;
} => {
  const res = {
    statusCodeCaptured: undefined,
    payload: undefined,
    status(code: number) {
      this.statusCodeCaptured = code;
      return this;
    },
    json(data: unknown) {
      this.payload = data;
      return this;
    },
  } as Response & { statusCodeCaptured?: number; payload?: unknown };

  return res;
};

describe('graphqlCsrfGuard', () => {
  it('allows non-mutation requests', () => {
    const req = createReq({ body: { query: 'query Me { me { id } }' } });
    const res = createRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };

    graphqlCsrfGuard(req, res, next);

    assert.equal(called, true);
    assert.equal(res.statusCodeCaptured, undefined);
  });

  it('allows cookie-auth mutation from allowlisted origin', () => {
    const prevOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173';

    const req = createReq({
      headers: {
        cookie: 'budgetshare_access=abc',
        origin: 'http://localhost:5173',
      },
      body: { query: 'mutation AddExpense { addExpense(input: {title: "x", amount: 1, transactionDate: "2026-01-01", category: "General", split: Personal}) { id } }' },
    });
    const res = createRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };

    try {
      graphqlCsrfGuard(req, res, next);
      assert.equal(called, true);
      assert.equal(res.statusCodeCaptured, undefined);
    } finally {
      process.env.ALLOWED_ORIGINS = prevOrigins;
    }
  });

  it('blocks cookie-auth mutation from non-allowlisted origin', () => {
    const prevOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173';

    const req = createReq({
      headers: {
        cookie: 'budgetshare_refresh=xyz',
        origin: 'https://evil.example',
      },
      body: { query: 'mutation Logout { logout }' },
    });
    const res = createRes();
    let called = false;
    const next: NextFunction = () => {
      called = true;
    };

    try {
      graphqlCsrfGuard(req, res, next);
      assert.equal(called, false);
      assert.equal(res.statusCodeCaptured, 403);
      assert.deepEqual(res.payload, {
        errors: [{ message: 'CSRF validation failed for cookie-authenticated mutation.' }],
      });
    } finally {
      process.env.ALLOWED_ORIGINS = prevOrigins;
    }
  });
});
