import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { validateProductionEnv } from './validateProductionEnv.js';

const ORIGINAL_ENV = { ...process.env };

const restoreEnv = (): void => {
  process.env = { ...ORIGINAL_ENV };
};

describe('validateProductionEnv', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('does nothing in development', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOWED_ORIGINS;
    assert.doesNotThrow(() => validateProductionEnv());
  });

  it('requires ALLOWED_ORIGINS in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '1';
    delete process.env.ALLOWED_ORIGINS;
    assert.throws(() => validateProductionEnv(), /ALLOWED_ORIGINS/);
  });

  it('rejects localhost-only origins in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '1';
    process.env.ALLOWED_ORIGINS = 'http://localhost:5173';
    assert.throws(() => validateProductionEnv(), /public site URL/);
  });

  it('passes with a public origin and TRUST_PROXY', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = '1';
    process.env.ALLOWED_ORIGINS = 'https://soperfect.dk';
    assert.doesNotThrow(() => validateProductionEnv());
  });
});
