import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { createHttpApp } from '../createApp.js';
import type { HttpServerBundle } from '../createApp.js';

const runIntegration = process.env.GRAPHQL_INTEGRATION_TESTS === '1';

const defaultOrigin =
  process.env.ALLOWED_ORIGINS?.split(',')[0]?.trim() || 'http://localhost:5173';

(runIntegration ? describe : describe.skip)('GraphQL cookie auth (HTTP integration)', () => {
  let bundle: HttpServerBundle;

  before(async () => {
    bundle = await createHttpApp();
  });

  after(async () => {
    await bundle.apollo.stop();
  });

  it('register → refreshSession → me → logout → unauthenticated', async () => {
    const agent = request.agent(bundle.app);
    const email = `it-auth-${Date.now()}@example.com`;
    const password = 'password12';

    const registerRes = await agent
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({
        query: `mutation R($input: RegisterInput!) { register(input: $input) { user { id email fullName } } }`,
        variables: { input: { email, password, fullName: 'Integration User' } },
      });
    assert.equal(registerRes.status, 200);
    assert.ok(registerRes.body.data?.register?.user?.id);
    assert.equal(registerRes.body.data.register.user.email, email.toLowerCase());

    const refreshRes = await agent
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({
        query: `mutation { refreshSession(input: {}) { user { id email } } }`,
      });
    assert.equal(refreshRes.status, 200);
    assert.equal(refreshRes.body.data.refreshSession.user.email, email.toLowerCase());

    const meBefore = await agent
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({ query: `query { me { email } }` });
    assert.equal(meBefore.status, 200);
    assert.equal(meBefore.body.data.me.email, email.toLowerCase());

    const logoutRes = await agent
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({ query: `mutation { logout }` });
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.body.data.logout, true);

    const meAfter = await agent
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({ query: `query { me { email } }` });
    assert.equal(meAfter.status, 200);
    assert.equal(meAfter.body.data.me, null);

    const refreshAfterLogout = await agent
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({
        query: `mutation { refreshSession(input: {}) { user { id } } }`,
      });
    assert.equal(refreshAfterLogout.status, 200);
    assert.ok(
      refreshAfterLogout.body.errors?.length,
      'refresh after logout should return GraphQL errors',
    );
  });

  it('logout on one device does not revoke another device session', async () => {
    const email = `it-multi-${Date.now()}@example.com`;
    const password = 'password12';
    const registerInput = {
      query: `mutation R($input: RegisterInput!) { register(input: $input) { user { id } } }`,
      variables: { input: { email, password, fullName: 'Multi Device' } },
    };

    const deviceA = request.agent(bundle.app);
    const deviceB = request.agent(bundle.app);

    await deviceA.post('/graphql').set('Origin', defaultOrigin).send(registerInput);
    await deviceB
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({
        query: `mutation L($input: LoginInput!) { login(input: $input) { user { id } } }`,
        variables: { input: { email, password, rememberMe: true } },
      });

    const logoutA = await deviceA
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({ query: `mutation { logout }` });
    assert.equal(logoutA.status, 200);
    assert.equal(logoutA.body.data.logout, true);

    const refreshB = await deviceB
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({ query: `mutation { refreshSession(input: {}) { user { email } } }` });
    assert.equal(refreshB.status, 200);
    assert.equal(refreshB.body.data.refreshSession.user.email, email.toLowerCase());

    const refreshA = await deviceA
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({ query: `mutation { refreshSession(input: {}) { user { id } } }` });
    assert.equal(refreshA.status, 200);
    assert.ok(refreshA.body.errors?.length, 'logged-out device refresh should fail');
  });

  it('rejects cookie-authenticated mutation without allowlisted Origin (CSRF)', async () => {
    const agent = request.agent(bundle.app);
    const email = `it-csrf-${Date.now()}@example.com`;

    await agent
      .post('/graphql')
      .set('Origin', defaultOrigin)
      .send({
        query: `mutation R($input: RegisterInput!) { register(input: $input) { user { id } } }`,
        variables: { input: { email, password: 'password12', fullName: 'CSRF User' } },
      });

    const blocked = await agent
      .post('/graphql')
      .set('Content-Type', 'application/json')
      .send({ query: `mutation { logout }` });

    assert.equal(blocked.status, 403);
    assert.match(
      String(blocked.body?.errors?.[0]?.message ?? ''),
      /CSRF validation failed/i,
    );
  });
});
