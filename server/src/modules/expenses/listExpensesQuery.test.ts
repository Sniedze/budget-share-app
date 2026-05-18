import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildListExpensesSql } from './listExpensesQuery.js';

describe('buildListExpensesSql', () => {
  it('scopes to creator personal expenses and member groups', () => {
    const { sql, params } = buildListExpensesSql(
      '7',
      { userId: '7', fullName: 'Alex', email: 'alex@example.com' },
      new Set([1, 2]),
    );
    assert.match(sql, /created_by_user_id = \?/);
    assert.match(sql, /group_id IN \(\?\)/);
    assert.equal(params[0], 7);
    assert.deepEqual(params[params.length - 2], [1, 2]);
  });

  it('omits group clause when viewer has no households', () => {
    const { sql, params } = buildListExpensesSql(
      '3',
      { userId: '3', fullName: 'Sam', email: 'sam@example.com' },
      new Set(),
    );
    assert.doesNotMatch(sql, /group_id IN/);
    assert.equal(params[0], 3);
  });
});
