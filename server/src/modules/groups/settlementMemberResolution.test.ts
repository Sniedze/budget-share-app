import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSettlementMemberName } from './settlementMemberResolution.js';

const members = [
  { name: 'Alex', email: 'alex@example.com', ratio: 50, userId: '1' },
  { name: 'Sam', email: 'sam@example.com', ratio: 50, userId: '2' },
];

describe('resolveSettlementMemberName', () => {
  it('matches exact member names', () => {
    assert.equal(resolveSettlementMemberName('Alex', members), 'Alex');
  });

  it('matches full name to short household member name', () => {
    assert.equal(resolveSettlementMemberName('Alex Example', members), 'Alex');
  });

  it('returns undefined when ambiguous', () => {
    const ambiguous = [
      { name: 'Alex A', email: 'a@example.com', ratio: 50, userId: '1' },
      { name: 'Alex B', email: 'b@example.com', ratio: 50, userId: '2' },
    ];
    assert.equal(resolveSettlementMemberName('Alex', ambiguous), undefined);
  });
});
