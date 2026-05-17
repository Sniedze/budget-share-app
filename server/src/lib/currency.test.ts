import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError, ErrorCode } from '../graphql/appError.js';
import { DEFAULT_CURRENCY, normalizeExpenseCurrency } from './currency.js';

describe('normalizeExpenseCurrency', () => {
  it('defaults to DKK when omitted', () => {
    assert.equal(normalizeExpenseCurrency(), DEFAULT_CURRENCY);
    assert.equal(normalizeExpenseCurrency(null), DEFAULT_CURRENCY);
  });

  it('accepts any 3-letter ISO code', () => {
    assert.equal(normalizeExpenseCurrency('eur'), 'EUR');
    assert.equal(normalizeExpenseCurrency(' USD '), 'USD');
  });

  it('rejects invalid codes', () => {
    assert.throws(
      () => normalizeExpenseCurrency('DK'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.extensions?.code, ErrorCode.BAD_USER_INPUT);
        return true;
      },
    );
  });
});
