# Deployment Readiness Checklist

Use this when deploying the Budget Share app to production.

## 1) Infrastructure and domains

- [ ] Choose hosting targets:
  - Frontend: static host (for example Vercel/Netlify/Cloudflare Pages)
  - Server: Node host (for example Render/Railway/Fly)
  - Database: MySQL managed instance
- [ ] Ensure TLS/HTTPS is enabled for both frontend and API.
- [ ] Decide final URLs:
  - Frontend URL (for example `https://soperfect.dk`)
  - API URL (for example `https://api.soperfect.dk/graphql`)
- [ ] Set DNS records and lower TTL before cutover.

## 2) Required environment variables

## Server (`server`)

Set these in your server host:

- [ ] `NODE_ENV=production`
- [ ] `PORT` (provided by host, if required)
- [ ] `TRUST_PROXY=1` (if behind reverse proxy/load balancer)
- [ ] `ALLOWED_ORIGINS=https://soperfect.dk`
- [ ] `DB_HOST`
- [ ] `DB_PORT`
- [ ] `DB_USER`
- [ ] `DB_PASSWORD`
- [ ] `DB_NAME`
- [ ] `JWT_ACCESS_SECRET` (strong random secret)
- [ ] `JWT_REFRESH_SECRET` (strong random secret)
- [ ] `JWT_ACCESS_TTL_SECONDS` (optional; default 900)
- [ ] `JWT_REFRESH_TTL_SECONDS` (optional; default 604800)
- [ ] `JSON_BODY_LIMIT` (optional; default `512kb`)
- [ ] `GRAPHQL_MAX_RECURSIVE_SELECTIONS` (optional; default 30)
- [ ] `GRAPHQL_RATE_LIMIT_AUTH` (optional; default 100)
- [ ] `GRAPHQL_RATE_LIMIT_GENERAL` (optional; default 800)

### Invitation email (SMTP)

- [ ] `APP_PUBLIC_URL=https://soperfect.dk`
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT` (for example `587`)
- [ ] `SMTP_SECURE` (`1` for SMTPS/465, otherwise `0`)
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`
- [ ] `SMTP_FROM` (for example `BudgetShare <noreply@soperfect.dk>`)
- [ ] `SMTP_RETRY_MAX_ATTEMPTS` (optional; default 3)
- [ ] `SMTP_RETRY_BASE_DELAY_MS` (optional; default 300)

## Client (`client`)

Set these in your frontend host build environment:

- [ ] `VITE_GRAPHQL_URL=https://api.soperfect.dk/graphql`

## 3) Database and migrations

- [ ] Confirm MySQL instance is reachable from server host.
- [ ] Start server once in production env and verify logs show:
  - DB connection established
  - schema ensured
  - schema migrated
- [ ] Validate essential tables exist (`users`, `groups`, `group_members`, `group_invitations`, `expenses`).

## 4) Security checks before go-live

- [ ] Cookies are secure in production:
  - `HttpOnly`
  - `SameSite=Lax`
  - `Secure` flag present (requires HTTPS + `NODE_ENV=production`)
- [ ] CORS allows only your real frontend origin(s).
- [ ] JWT secrets are long random values, not defaults.
- [ ] SMTP credentials are in host secrets only (not in git).

## 5) Smoke test plan (manual)

Run these from the deployed frontend:

- [ ] Register a new user.
- [ ] Login and refresh page (session persists).
- [ ] Create a household with:
  - one member email that already has an account
  - one member email without an account
- [ ] Verify invitation emails are sent.
- [ ] Login/logout/login cycle works.
- [ ] Create/edit/delete an expense.
- [ ] Open settlements page and verify it loads.
- [ ] Import a small sample statement and confirm rows are handled.

## 6) Observability and rollback

- [ ] Confirm request logs include `x-request-id`.
- [ ] Confirm GraphQL errors include `extensions.requestId`.
- [ ] Keep previous deployment available for fast rollback.
- [ ] Keep DB backups/snapshots enabled before first production write traffic.

## 7) Cutover

- [ ] Deploy backend.
- [ ] Deploy frontend.
- [ ] Update DNS to new frontend/API endpoints.
- [ ] Re-run smoke test after DNS propagation.
- [ ] Monitor logs for 24 hours (auth failures, SMTP failures, 5xx).
