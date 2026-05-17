import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  findViewerGroupMember,
  groupMemberMatchesViewerClause,
  groupMemberMatchesViewerParams,
  normalizeMemberEmail,
  parseViewerUserId,
} from './memberIdentity.js';

describe('memberIdentity', () => {
  it('normalizes member email', () => {
    assert.equal(normalizeMemberEmail('  User@Example.com '), 'user@example.com');
  });

  it('parses positive viewer user ids', () => {
    assert.equal(parseViewerUserId('42'), 42);
  });

  it('rejects invalid viewer user ids', () => {
    assert.throws(() => parseViewerUserId('abc'));
  });

  it('builds membership match clause and params', () => {
    assert.match(groupMemberMatchesViewerClause('gm'), /gm\.user_id = \?/);
    assert.match(groupMemberMatchesViewerClause(), /(?<![.\w])user_id = \?/);
    assert.doesNotMatch(groupMemberMatchesViewerClause(), /gm\.user_id/);
    assert.deepEqual(groupMemberMatchesViewerParams({ userId: '3', email: 'A@b.com' }), [3, 'a@b.com']);
  });

  it('finds viewer member by userId before email', () => {
    const members = [
      { userId: '1', email: 'old@example.com', name: 'A' },
      { userId: '2', email: 'b@example.com', name: 'B' },
    ];
    const found = findViewerGroupMember(members, { userId: '2', email: 'other@example.com' });
    assert.equal(found?.name, 'B');
  });
});
