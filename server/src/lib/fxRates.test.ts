import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { getFxRate } from './fxRates.js';

describe('getFxRate', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('returns 1 for identical currencies', async () => {
    assert.equal(await getFxRate('DKK', 'dkk'), 1);
  });

  it('returns direct rate from Frankfurter response', async () => {
    mock.method(globalThis, 'fetch', async () =>
      Response.json({
        rates: { DKK: 7.45, USD: 1.08 },
      }),
    );
    const rate = await getFxRate('EUR', 'DKK');
    assert.equal(rate, 7.45);
  });
});
