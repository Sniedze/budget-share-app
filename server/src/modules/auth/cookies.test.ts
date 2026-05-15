import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Request, Response } from 'express';
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_HINT_COOKIE_NAME,
  clearSessionCookies,
  getAccessTokenFromCookies,
  getRefreshTokenFromCookies,
  setSessionCookies,
} from './cookies.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './jwt.js';

const createReqWithCookie = (cookieHeader: string | undefined): Request =>
  ({
    headers: { cookie: cookieHeader },
  }) as unknown as Request;

const createCaptureRes = (): Response & { setCookies: string[] } => {
  const setCookies: string[] = [];
  const res = {
    setCookies,
    appendHeader(name: string, value: string) {
      if (name === 'Set-Cookie') {
        setCookies.push(value);
      }
    },
  } as unknown as Response & { setCookies: string[] };
  return res;
};

describe('auth cookies', () => {
  it('reads access token from Cookie header', () => {
    const token = 'abc.def.ghi';
    const req = createReqWithCookie(`${ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}; other=x`);
    assert.equal(getAccessTokenFromCookies(req), token);
  });

  it('reads refresh token from Cookie header', () => {
    const token = 'refresh.value';
    const req = createReqWithCookie(`foo=1; ${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`);
    assert.equal(getRefreshTokenFromCookies(req), token);
  });

  it('returns null when cookie header is missing', () => {
    const req = createReqWithCookie(undefined);
    assert.equal(getAccessTokenFromCookies(req), null);
    assert.equal(getRefreshTokenFromCookies(req), null);
  });

  it('setSessionCookies with remember sets Max-Age on access and refresh', () => {
    const res = createCaptureRes();
    setSessionCookies(res, 'access-token', 'refresh-token', { remember: true });
    assert.equal(res.setCookies.length, 3);
    assert.match(res.setCookies[0], new RegExp(`^${ACCESS_COOKIE_NAME}=access-token`));
    assert.match(res.setCookies[0], new RegExp(`Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`));
    assert.match(res.setCookies[0], /Path=\/graphql/);
    assert.match(res.setCookies[0], /HttpOnly/);
    assert.match(res.setCookies[0], /SameSite=Lax/);
    assert.match(res.setCookies[1], new RegExp(`^${REFRESH_COOKIE_NAME}=refresh-token`));
    assert.match(res.setCookies[1], new RegExp(`Max-Age=${REFRESH_TOKEN_TTL_SECONDS}`));
  });

  it('setSessionCookies without remember omits Max-Age on refresh (session cookie)', () => {
    const res = createCaptureRes();
    setSessionCookies(res, 'a', 'r', { remember: false });
    assert.equal(res.setCookies.length, 3);
    assert.match(res.setCookies[0], new RegExp(`Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`));
    assert.match(res.setCookies[1], new RegExp(`^${REFRESH_COOKIE_NAME}=r`));
    assert.doesNotMatch(res.setCookies[1], /Max-Age=/);
  });

  it('clearSessionCookies clears both cookies with Max-Age=0', () => {
    const res = createCaptureRes();
    clearSessionCookies(res);
    assert.equal(res.setCookies.length, 3);
    assert.match(res.setCookies[0], new RegExp(`^${ACCESS_COOKIE_NAME}=;`));
    assert.match(res.setCookies[0], /Max-Age=0/);
    assert.match(res.setCookies[1], new RegExp(`^${REFRESH_COOKIE_NAME}=;`));
    assert.match(res.setCookies[1], /Max-Age=0/);
    assert.match(res.setCookies[2], new RegExp(`^${SESSION_HINT_COOKIE_NAME}=;`));
    assert.match(res.setCookies[2], /Max-Age=0/);
  });
});
