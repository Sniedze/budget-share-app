import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRecordSettlementPaymentInput } from './validation.js';

describe('groups validation', () => {
  it('accepts null optional settlement fields from GraphQL', () => {
    const parsed = parseRecordSettlementPaymentInput({
      groupId: '1',
      expenseGroup: null,
      fromMember: 'Mike',
      toMember: 'Jane',
      amount: 100,
      note: null,
      settledAt: '2026-05-15',
    });
    assert.equal(parsed.expenseGroup, undefined);
    assert.equal(parsed.note, undefined);
    assert.equal(parsed.fromMember, 'Mike');
  });
});
