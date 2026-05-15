import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toStoredSplitDetails } from './splitAllocation.js';

describe('toStoredSplitDetails', () => {
  it('allocates residual cents to the last participant', () => {
    const result = toStoredSplitDetails(100, [
      { participant: 'Alice', ratio: 33.33 },
      { participant: 'Bob', ratio: 33.33 },
      { participant: 'Carol', ratio: 33.34 },
    ]);
    const total = result.reduce((sum, row) => sum + row.amount, 0);
    assert.equal(total, 100);
    assert.equal(result[result.length - 1]?.amount, 33.34);
  });

  it('returns empty array when split details are missing', () => {
    assert.deepEqual(toStoredSplitDetails(50, undefined), []);
  });
});
