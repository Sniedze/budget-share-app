import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { roundCents } from './money.js';

describe('roundCents', () => {
  it('rounds to two decimal places', () => {
    assert.equal(roundCents(10.005), 10.01);
    assert.equal(roundCents(99.994), 99.99);
    assert.equal(roundCents(0), 0);
  });
});
