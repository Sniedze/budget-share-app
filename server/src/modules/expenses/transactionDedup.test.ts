import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeTransactionDedupHash,
  normalizeTransactionDescriptionForDedup,
  transactionDateKeyForDedup,
  transactionDedupFieldsUnchanged,
} from './transactionDedup.js';

describe('transactionDedup', () => {
  it('normalizes description whitespace and case', () => {
    assert.equal(normalizeTransactionDescriptionForDedup('  Foo   BAR  '), 'foo bar');
  });

  it('uses stable date key from ISO input', () => {
    assert.equal(transactionDateKeyForDedup('2026-05-15T12:00:00.000Z'), '2026-05-15');
  });

  it('differs outgoing vs incoming fingerprints', () => {
    const outgoing = computeTransactionDedupHash('2026-05-15', 100, 'Coffee', 'Outgoing');
    const incoming = computeTransactionDedupHash('2026-05-15', 100, 'Coffee', 'Incoming');
    assert.notEqual(outgoing, incoming);
  });

  it('matches same inputs', () => {
    const a = computeTransactionDedupHash('2026-05-15', 99.99, 'Netto', 'Outgoing');
    const b = computeTransactionDedupHash('2026-05-15', 99.99, 'netto', 'Outgoing');
    assert.equal(a, b);
  });

  it('detects unchanged dedup fields on edit', () => {
    assert.equal(
      transactionDedupFieldsUnchanged({
        existingTransactionDate: '2026-05-15T00:00:00.000Z',
        existingAmount: '100.00',
        existingTitle: 'Coffee Shop',
        existingFlow: 'Outgoing',
        nextTransactionDate: '2026-05-15',
        nextAmount: 100,
        nextTitle: 'coffee shop',
        nextFlow: 'Outgoing',
      }),
      true,
    );
    assert.equal(
      transactionDedupFieldsUnchanged({
        existingTransactionDate: '2026-05-15T00:00:00.000Z',
        existingAmount: '100.00',
        existingTitle: 'Coffee Shop',
        existingFlow: 'Outgoing',
        nextTransactionDate: '2026-05-15',
        nextAmount: 101,
        nextTitle: 'Coffee Shop',
        nextFlow: 'Outgoing',
      }),
      false,
    );
  });
});
