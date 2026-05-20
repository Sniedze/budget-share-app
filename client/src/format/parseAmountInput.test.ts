import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseLocaleAmountInput } from './parseAmountInput.js';

describe('parseLocaleAmountInput', () => {
  it('parses plain numbers', () => {
    assert.equal(parseLocaleAmountInput('15000'), 15000);
    assert.equal(parseLocaleAmountInput('3353'), 3353);
  });

  it('parses da-DK thousands and decimals', () => {
    assert.equal(parseLocaleAmountInput('15.000'), 15000);
    assert.equal(parseLocaleAmountInput('3.353,00'), 3353);
  });
});
