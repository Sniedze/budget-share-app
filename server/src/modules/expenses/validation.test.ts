import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError, ErrorCode } from '../../graphql/appError.js';
import { parseCreateExpenseInput, parseImportExpenseRows } from './validation.js';

describe('expenses validation', () => {
  it('parses a valid create expense input', () => {
    const parsed = parseCreateExpenseInput({
      title: 'Coffee',
      amount: 45.5,
      transactionDate: '2026-05-01',
      category: 'Food',
      split: 'Personal',
      currency: 'DKK',
      flow: 'Outgoing',
    });
    assert.equal(parsed.title, 'Coffee');
    assert.equal(parsed.amount, 45.5);
    assert.equal(parsed.currency, 'DKK');
  });

  it('accepts non-DKK ISO currency codes', () => {
    const parsed = parseCreateExpenseInput({
      title: 'Hotel',
      amount: 100,
      transactionDate: '2026-05-01',
      category: 'Travel',
      split: 'Personal',
      currency: 'EUR',
    });
    assert.equal(parsed.currency, 'EUR');
  });

  it('rejects empty title', () => {
    assert.throws(
      () =>
        parseCreateExpenseInput({
          title: '   ',
          amount: 10,
          transactionDate: '2026-05-01',
          category: 'Food',
          split: 'Personal',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.extensions?.code, ErrorCode.BAD_USER_INPUT);
        return true;
      },
    );
  });

  it('caps import batch size', () => {
    const rows = Array.from({ length: 1001 }, (_, index) => ({
      clientRowId: String(index),
      title: 'Item',
      amount: 1,
      transactionDate: '2026-05-01',
      category: 'Food',
      split: 'Personal',
    }));
    assert.throws(
      () => parseImportExpenseRows({ rows }),
      (error: unknown) => error instanceof AppError,
    );
  });
});
