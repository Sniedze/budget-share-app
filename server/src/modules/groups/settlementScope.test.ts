import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildOptimizedTransfers } from './settlementTransfers.js';

describe('settlement GraphQL safety', () => {
  it('buildOptimizedTransfers never returns NaN amounts', () => {
    const transfers = buildOptimizedTransfers([
      { memberName: 'A', amount: Number.NaN },
      { memberName: 'B', amount: -50 },
      { memberName: 'C', amount: 50 },
    ]);
    for (const transfer of transfers) {
      assert.ok(Number.isFinite(transfer.amount));
      assert.ok(transfer.amount > 0);
    }
  });
});
