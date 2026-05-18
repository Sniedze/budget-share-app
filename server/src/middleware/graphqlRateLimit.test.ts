import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import { extractLoginRegisterEmail, resolveGraphqlRateLimit } from './graphqlRateLimit.js';

const reqWithBody = (body: unknown): Request =>
  ({
    body,
    ip: '203.0.113.10',
  }) as Request;

describe('extractLoginRegisterEmail', () => {
  it('reads email from GraphQL variables', () => {
    const email = extractLoginRegisterEmail(
      reqWithBody({
        query: 'mutation Login($input: LoginInput!) { login(input: $input) { user { id } } }',
        variables: { input: { email: 'User@Example.com', password: 'secret' } },
      }),
    );
    assert.equal(email, 'user@example.com');
  });

  it('returns null when variables omit email', () => {
    const email = extractLoginRegisterEmail(
      reqWithBody({
        query: 'mutation { login(input: { password: "x" }) { user { id } } }',
      }),
    );
    assert.equal(email, null);
  });
});

describe('resolveGraphqlRateLimit', () => {
  it('uses the session cap for RefreshSession and ChangePassword', () => {
    assert.equal(
      resolveGraphqlRateLimit(
        reqWithBody({
          operationName: 'RefreshSession',
          query: 'mutation RefreshSession { refreshSession { user { id } } }',
        }),
      ),
      60,
    );
    assert.equal(
      resolveGraphqlRateLimit(
        reqWithBody({
          operationName: 'ChangePassword',
        }),
      ),
      60,
    );
  });

  it('uses the auth cap for Login', () => {
    assert.equal(
      resolveGraphqlRateLimit(
        reqWithBody({
          operationName: 'Login',
          query: 'mutation Login($input: LoginInput!) { login(input: $input) { user { id } } }',
        }),
      ),
      100,
    );
  });
});
