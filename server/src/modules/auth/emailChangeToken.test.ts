import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createEmailChangeToken, hashEmailChangeToken } from './emailChangeToken.js';

describe('emailChangeToken', () => {
  it('hashes tokens deterministically', () => {
    const token = 'abc123';
    assert.equal(hashEmailChangeToken(token), hashEmailChangeToken(token));
    assert.notEqual(hashEmailChangeToken(token), hashEmailChangeToken('other'));
  });

  it('creates long random tokens', () => {
    const token = createEmailChangeToken();
    assert.equal(token.length, 64);
    assert.notEqual(token, createEmailChangeToken());
  });
});
