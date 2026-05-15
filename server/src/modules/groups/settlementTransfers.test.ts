import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOptimizedTransfers } from './settlementTransfers.js';

describe('buildOptimizedTransfers', () => {
  it('settles balances with minimum transfers', () => {
    const transfers = buildOptimizedTransfers([
      { memberName: 'Alice', amount: 50 },
      { memberName: 'Bob', amount: -30 },
      { memberName: 'Carol', amount: -20 },
    ]);
    assert.equal(transfers.length, 2);
    const total = transfers.reduce((sum, row) => sum + row.amount, 0);
    assert.equal(total, 50);
  });

  it('returns no transfers when balances are settled', () => {
    assert.deepEqual(
      buildOptimizedTransfers([
        { memberName: 'Alice', amount: 0 },
        { memberName: 'Bob', amount: 0 },
      ]),
      [],
    );
  });
});
