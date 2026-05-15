import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request } from 'express';
import { extractLoginRegisterEmail } from './graphqlRateLimit.js';

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
