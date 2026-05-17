import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { createHash } from 'node:crypto';
import { isHibpPasswordCheckEnabled, isPasswordBreached } from './hibp.js';

describe('isHibpPasswordCheckEnabled', () => {
  afterEach(() => {
    delete process.env.HIBP_PASSWORD_CHECK;
  });

  it('is enabled by default', () => {
    assert.equal(isHibpPasswordCheckEnabled(), true);
  });

  it('can be disabled with HIBP_PASSWORD_CHECK=off', () => {
    process.env.HIBP_PASSWORD_CHECK = 'off';
    assert.equal(isHibpPasswordCheckEnabled(), false);
  });
});

describe('isPasswordBreached', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('returns true when suffix is in range response', async () => {
    const password = 'breached-test-password';
    const sha1 = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    mock.method(globalThis, 'fetch', async (url: string | URL) => {
      assert.match(String(url), new RegExp(`/range/${prefix}$`));
      return new Response(`${suffix}:123\n`, { status: 200 });
    });

    assert.equal(await isPasswordBreached(password), true);
  });

  it('returns false when suffix is absent', async () => {
    mock.method(globalThis, 'fetch', async () => new Response('00000:1\n', { status: 200 }));
    assert.equal(await isPasswordBreached('unique-password-xyz'), false);
  });
});
