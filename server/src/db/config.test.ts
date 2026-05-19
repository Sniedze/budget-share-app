import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { resolveDbConfig } from './config.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('resolveDbConfig', () => {
  it('uses MYSQL_* when DB_* is unset in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DB_USER;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;
    process.env.MYSQL_USER = 'compose_user';
    process.env.MYSQL_PASSWORD = 'compose_pass';
    process.env.MYSQL_DATABASE = 'compose_db';

    const config = resolveDbConfig();
    assert.equal(config.user, 'compose_user');
    assert.equal(config.password, 'compose_pass');
    assert.equal(config.database, 'compose_db');
  });

  it('defaults in development when no credentials are set', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DB_USER;
    delete process.env.MYSQL_USER;

    const config = resolveDbConfig();
    assert.equal(config.user, 'budget_user');
  });
});
