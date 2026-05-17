import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBulkInsertPlaceholders } from './queryHelpers.js';

describe('buildBulkInsertPlaceholders', () => {
  it('builds comma-separated value groups', () => {
    assert.equal(buildBulkInsertPlaceholders(2, 3), '(?, ?, ?), (?, ?, ?)');
    assert.equal(buildBulkInsertPlaceholders(1, 1), '(?)');
  });
});
