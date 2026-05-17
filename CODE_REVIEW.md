# Budget-Share-App — Code Review (Updated)

Reviewed against `main` at commit `7a0586d` (Merge PR #23 from `test/auth-cookie-unit-tests`, 2026-05-12). Delta from the previous review (`ee60dfe`): **35 commits, 49 files changed, +1,906 / -392 lines**, including 19 new PRs touching auth cookies, CSRF, observability, configuration, dedup helpers, batched inserts, bundle splitting, tests, and CI.

This is a substantial step forward. **Most of the Critical and High findings from the previous review have been resolved.** This file replaces the previous one and grades each finding as **✓ Resolved**, **◐ Partially resolved**, **✗ Still open**, or **+ Newly observed**. Strong parts are preserved at the top so the picture stays fair.

---

## What's working well (now includes the new infrastructure)

Foundational pieces — kept from the previous pass:

- **Authentication architecture**: bcryptjs `SALT_ROUNDS = 12`, separate access/refresh JWT secrets, explicit token-type checks. Login throws the same error on unknown email and bad password (no user enumeration).
- **SQL is fully parameterized.** Every `db.execute` / `db.query` uses `?` placeholders. No string concatenation of untrusted input.
- **Per-record authorization** on every list/create/update/delete path; private expenses additionally check creator identity.
- **Settlement math**: greedy minimum-transfers algorithm with cent-rounding; split allocation rounds residual to last allocation so totals reconcile.
- **Transaction-level dedup**: SHA-256 of (date, cents, normalized title, flow) with per-creator unique index.
- **Audit logging**: actor + before/after JSON for destructive writes.
- **Clean layering**: `resolvers → modules/<feature>/service → db/mysql`.
- **`HouseholdPage` already extracted its state into `useHouseholdPageState`** — the right pattern.

New since last review — these are real upgrades:

- **httpOnly cookie sessions on `/graphql`** (`server/src/modules/auth/cookies.ts`). `SameSite=Lax`, `Secure` in production, path-scoped so cookies don't leak to `/health`. Access token has fixed Max-Age; refresh token only sets Max-Age when `remember=true` (session cookie otherwise). `clearSessionCookies` is called on logout.
- **Server-side refresh-token revocation** (`auth/jwt.ts:9-14`, `auth/service.ts:147-156, 120-145`). Refresh JWT carries `rtv` (refresh token version). `users.refresh_token_version` increments on logout (`resolvers.ts:115-121`). Replayed refresh JWTs are rejected (`auth/service.ts:140-142`).
- **CSRF middleware** (`server/src/middleware/graphqlCsrfGuard.ts`). Cookie-authenticated mutations are rejected with HTTP 403 unless `Origin` (or `Referer` origin fallback) matches `ALLOWED_ORIGINS`. Only applies when a session cookie is present, so unauthenticated and bearer-token traffic isn't broken.
- **CORS allowlist** (`server/src/config/corsOptions.ts`). `ALLOWED_ORIGINS` (comma-separated) replaces wildcard CORS; falls back to local Vite/SPA dev ports if unset. `credentials: true` enabled for cookie auth.
- **Request-ID end-to-end correlation** (`middleware/requestContext.ts`, `logger.ts`, `createApp.ts:41-49`). Incoming `x-request-id` is preserved or a fresh UUID is generated. Stored in `AsyncLocalStorage` so the Apollo `formatError` hook can stamp `extensions.requestId` on every GraphQL error. HTTP request completion is logged.
- **Structured JSON logger** (`server/src/logger.ts`). Emits `level`, `event`, `time` and structured fields. `logAuthzDenied` is called on every authorization rejection in the expenses module (`expenses/service.ts:425-450`) with the specific reason.
- **GraphQL recursive selection guard** (`createApp.ts:15-25, 40`). `maxRecursiveSelections` defaults to 30, configurable via `GRAPHQL_MAX_RECURSIVE_SELECTIONS`.
- **Request body size cap** (`createApp.ts:58-59`). `JSON_BODY_LIMIT` (default `512kb`).
- **`createApp.ts` separates wiring from `listen`** so the app is testable end-to-end (`graphqlAuthHttp.integration.test.ts` uses `request.agent(bundle.app)` against the real Express+Apollo stack).
- **Tests now exist.** `server/src/modules/auth/cookies.test.ts`, `middleware/graphqlCsrfGuard.test.ts`, `middleware/requestContext.test.ts`, `graphql/graphqlAuthHttp.integration.test.ts`. Wired into `npm test` via `scripts/run-tests.mjs` and exercised in CI.
- **CI runs build + tests against a real MySQL** (`.github/workflows/ci.yml`). Two jobs: build for client/server; `server-tests-smoke` boots MySQL 8.4, runs `npm test`, builds, starts the server, and smoke-checks `/health`. `audit-gate` workflow still runs on its own.
- **Hardcoded DB creds removed from docker-compose** (`docker-compose.yml`). Now requires `${MYSQL_*:?...}` env vars; a `.env.example` lists every variable.
- **`VITE_GRAPHQL_URL` honored on the client** (`client/src/lib/apolloClient.ts:3-4`, `client/src/vite-env.d.ts`).
- **Route-level code splitting** (`client/src/App.tsx:1-21`). All pages are `React.lazy`'d behind a single `<Suspense fallback>`.
- **Bundle splitting** (`client/vite.config.ts`). `router`, `apollo`, `graphql`, `lucide`, `recharts` get their own chunks; recharts is deferred from the home bundle (per commit `cbf83fa`).
- **Batched multi-row inserts** for `group_members` and `group_invitations` (`groups/service.ts:539-580, 700-748`). The previous `Promise.all(INSERT)` per row was replaced by a single multi-row insert with `buildBulkInsertPlaceholders`.
- **Auth input validation centralized** (`auth/validation.ts`). Email format regex + length cap (254), full-name length cap, password length bounded (8 minimum, 72 max — matches bcrypt's truncation byte limit), control-character stripping on email and full name.
- **Login no longer leaks password-length signals** (`auth/validation.ts:48-53`). Oversized password rejected with the same `Invalid email or password.` message used for bad creds.
- **`requireAuth` helper** moved into `graphql/authz.ts` and logs `authz_denied` with operation name + request id on rejection.
- **`queryOne` / `queryMany` helpers** (`db/queryHelpers.ts`) eliminate the `const [rows] = await db.query(...); return rows[0] ?? null;` boilerplate that used to repeat in auth/service.ts six times.
- **`PROJECT_RULES.md` and `SECURITY.md`** are kept in sync with reality (the security doc now documents cookies, CSRF, request IDs, env knobs).
- **`.nvmrc` present** (per `SECURITY.md`; not visible in the diff but referenced).

This is genuinely good shipping. With the security posture and observability in place, the remaining work is mostly cleanup and a few last footguns.

---

## Status of every previous finding

### Critical (3) — all resolved

| # | Finding | Status |
|---|---|---|
| 1.1 | CORS wildcard | **✓ Resolved** — `config/corsOptions.ts` + `ALLOWED_ORIGINS` allowlist with `credentials: true` |
| 1.2 | Tokens in `localStorage` | **✓ Resolved** — httpOnly `SameSite=Lax` cookies on `/graphql`, `Secure` in prod (`modules/auth/cookies.ts`). Client `storage.ts` is now just a legacy-cleanup helper. |
| 1.3 | No server-side revocation on logout | **✓ Resolved** — `refresh_token_version` (`users.refresh_token_version`, `jwt.ts:rtv` claim) bumped by `revokeRefreshTokens` on logout; mismatched `rtv` rejected (`auth/service.ts:140-142`). |

### High (8) — five resolved, three still open

| # | Finding | Status |
|---|---|---|
| 1.4 | Hardcoded DB creds in `docker-compose.yml` | **✓ Resolved** — required-env interpolation `${VAR:?required}`, `.env.example` present |
| 1.5 | Hardcoded GraphQL URL | **✓ Resolved** — `import.meta.env.VITE_GRAPHQL_URL` read with localhost fallback for dev (`apolloClient.ts:3-4`) |
| 1.6 | `Authorization` parsing via `split(' ')` | **✓ Resolved** — `context.ts` uses `^Bearer\s+(\S+)$` regex; cookies preferred, bearer fallback. |
| 1.7 | Substring-coupled auth-error detection | **◐ Partially resolved** — `apolloClient.ts` uses `extensions.code` (`UNAUTHENTICATED`). Import duplicate detection still accepts legacy `Duplicate transaction:` prefix when `errorCode` is absent. |
| 1.8 | Server throws plain `Error` everywhere; no `extensions.code` | **✓ Resolved** — services use `appError`; boot-time config may still throw plain `Error`. |
| 1.9 | No central logger | **◐ Partially resolved** — `server/src/logger.ts` exists, emits structured JSON, logs request completion + authz denials + 5xx via `errorHandler`. Still uses `console.log/error/warn` underneath rather than pino/winston, has no log-level filtering via env, and doesn't log GraphQL resolver errors (only HTTP-level errors and select authz denials). |
| 1.16 | No `helmet` / CSP / HSTS | **✓ Resolved** — `helmet()` in `createApp.ts` (CSP disabled for GraphQL playground compatibility in dev). |
| 1.17 | No body-size limit | **✓ Resolved** — `express.json({ limit: process.env.JSON_BODY_LIMIT ?? '512kb' })` (`createApp.ts:58-59`) |

### Medium (16) — partial progress, most remain

| # | Finding | Status |
|---|---|---|
| 1.10 | Raw `Error` messages leak | **✓ Resolved** — `formatGraphqlError` scrubs non–client-safe errors in production and attaches `requestId`; `errorHandler` covers HTTP paths. |
| 1.11 | Email-as-identity | **✓ Resolved** — `user_id` on members; `invited_user_id` on invitations; inbox by user id or email. |
| 1.12 | Dedup hash edit footgun | **✓ Resolved** — `transactionDedupFieldsUnchanged` preserves hash when dedup fields unchanged on update. |
| 1.13 | Currency half-implemented | **◐ Partially resolved** — per-currency settlements (#49); budget totals scoped to dominant currency when mixed (#54). True FX conversion still out of scope. |
| 1.14 | Password policy minimal | **◐ Partially resolved** — letter+digit + `changePassword`; common-password blocklist on register/change (PR #51). No HIBP/zxcvbn API yet. |
| 1.15 | Login rate limit IP-only | **✓ Resolved** — login/register keyed by normalized email with IP fallback (`graphqlRateLimit.ts`). |
| 1.18 | `audit_logs.actor_email NOT NULL` vs `actor_user_id NULL` | **✓ Resolved** — `actor_user_id` NOT NULL after backfill; `actor_email` kept for audit display. |
| 1.19 | `/health` doesn't check DB | **✓ Resolved** — `/health` runs `checkDbConnection()` and returns 503 when DB is down. |
| 2.1 | Oversized page files | **✓ Resolved** — `ImportPage.tsx` and `BudgetPage.tsx` are thin shells; logic lives in `features/import/*` and `features/budget/*` + section components. |
| 2.2 | Three sources of truth (Apollo / state / localStorage) | **✓ Resolved** — `user_settings` table + `userWorkspaceSettings` / `saveUserWorkspaceSettings`; client migrates legacy localStorage on first load. |
| 2.3 | `listHouseholdSettlements` duplicates `listGroups` work | **✓ Resolved** — `loadAccessibleGroupsWithMembers` loads only settlement-scoped groups + members. |
| 2.4 | `refetchQueries` everywhere | **✓ Resolved** — batched `importExpenses` mutation; `refetchGroups(client)` + expense cache updates. |
| 2.5 | `ME` is `network-only` on every mount | **✓ Resolved** — skipped when session-hint absent; `cache-first` when hint present (PR #51). |
| 2.6 | No error boundary | **✓ Resolved** — `ErrorBoundary` wraps the app in `main.tsx`. |
| 2.7 | No route code splitting | **✓ Resolved** — `App.tsx:1-21` uses `React.lazy` for every page + a `<Suspense>` wrapper. |
| 2.8 | `<AuthBootstrap>` splash flicker | **✓ Resolved** — `RequireAuth` / `PublicOnly` use shared `PageLoading` while `isInitializing`. |

### Optimizations (4 high) — two resolved, two open

| # | Finding | Status |
|---|---|---|
| 3.1 | N+1 `isGroupMember` | **✓ Resolved** — `loadMemberGroupIds` prefetches membership once per request. |
| 3.3 | Missing indexes on foreign keys | **✓ Resolved** — `ensureIndex` in `db/mysql.ts` for expenses, group_members, invitations, settlements, audit_logs, refresh sessions. |
| 3.7 | `Promise.all(INSERT)` for members/invitations | **✓ Resolved** — `groups/service.ts:539-580, 700-748` now uses `buildBulkInsertPlaceholders` for a single multi-row insert. |
| 3.9 | Recharts in main bundle | **✓ Resolved** — `vite.config.ts manualChunks` splits recharts into its own chunk; commit `cbf83fa` defers recharts on the home page. |

### Duplications (10 high) — mostly still present

`roundCents` (3 places), `toIsoString` (2 places), three split-detail parsers, repeated user/expense SELECT projections, expense row→API mapping repeated 5×, group member-validation block repeated, invitation sync block repeated, hex colors outside tokens, two parallel `storage.ts` modules — all still present. The new `db/queryHelpers.ts` (`queryOne`, `queryMany`) is the right shape and reduces some boilerplate but the column-list strings and the row-mapping functions weren't extracted. The GraphQL field-list duplications in `client/src/features/expenses/graphql.ts` and `features/groups/graphql.ts` are also unchanged.

### Other (5 high) — all resolved

| # | Finding | Status |
|---|---|---|
| 5.1 | No tests | **✓ Resolved** — auth/CSRF/integration tests plus `transactionDedup.test.ts`, `splitAllocation.test.ts`, `settlementTransfers.test.ts`, `settlementPeriod.test.ts`. |
| 5.2 | No root README | **✓ Resolved** — root `README.md` with layout, local dev, deploy, tests. |
| 5.3 | No build/lint/test CI | **✓ Resolved** — CI builds client + server, runs server tests + smoke test, and `npm run lint` for both apps. |
| 5.4 | No `.nvmrc` | **✓ Resolved** (per `SECURITY.md`). |
| 5.5 | No server ESLint | **✓ Resolved** — `server/eslint.config.js` + `npm run lint`. |

### Modern code (4 high) — two partial, two open

| # | Finding | Status |
|---|---|---|
| 6.1 | No validation library | **✓ Resolved** — Zod schemas in `expenses/validation.ts` and `groups/validation.ts`, wired in GraphQL resolvers. Auth remains hand-rolled validators. |
| 6.2 | `refetchQueries` is the old way | **◐ Partially resolved** — expense + group cache updates; resend patches invitations (#57). Settlements still refetch by period. |
| 6.3 | No `<ErrorBoundary>` | **✓ Resolved** — `main.tsx` wraps the app. |
| 6.4 | `AuthContext` is one big context | **✓ Resolved** — split `AuthStateContext` / `AuthActionsContext`. |

---

## Issues that remain (consolidated with file:line)

### High — still open

**1.6 `Authorization` parsing is loose.** (`server/src/graphql/context.ts:20`)
```ts
const [scheme, token] = authHeader.split(' ');
```
Replace with `^/Bearer\s+(\S+)$/i`. Low priority now that cookies are the primary path, but the bearer fallback is still wired in.

**1.7 Substring-coupled auth-error detection (client).** (`client/src/lib/apolloClient.ts:22`)
```ts
return Boolean(body.errors?.some((e) => e.message?.includes('Authentication required')));
```
Plus `BACKEND_DUPLICATE_EXPENSE_PREFIX` in `features/expenses/graphqlErrors.ts:4`. Both rely on the English message staying byte-stable. Add `extensions.code = 'UNAUTHENTICATED' | 'DUPLICATE_TRANSACTION' | ...` server-side and switch on the code client-side.

**1.8 Plain `Error` throws server-wide; no `extensions.code` enum.** Every `throw new Error(...)` in `auth/service.ts`, `expenses/service.ts`, `groups/service.ts`. Define:
```ts
class AppError extends GraphQLError {
  constructor(code: ErrorCode, message: string) {
    super(message, { extensions: { code } });
  }
}
```
Then update `formatError` to convert unrecognized errors to `{ code: 'INTERNAL_SERVER_ERROR' }` and scrub messages.

**1.9 Logger doesn't catch GraphQL resolver errors.** (`createApp.ts:41-49`, `errorHandler.ts`)
`errorHandler` only fires for non-GraphQL paths (Apollo handles GraphQL paths itself). Resolver errors are visible only via the response body — they aren't written to the JSON log. Add a logging step inside `formatError`:
```ts
formatError(formattedError, error) {
  if (formattedError.extensions?.code !== 'UNAUTHENTICATED') {
    logServerError({ requestId: getCurrentRequestId() ?? 'unknown', /*...*/, message: formattedError.message });
  }
  return { ...formattedError, extensions: { ...formattedError.extensions, requestId: getCurrentRequestId() ?? 'unknown' } };
},
```

**1.16 No `helmet`.** (`createApp.ts`) Even with cookies + CSRF + CORS in place, you're missing `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`. Drop in `app.use(helmet())` after `assignRequestContext` and before `cors`.

**3.1 N+1 `isGroupMember`.** (`expenses/service.ts:230-266, 314, 416, 473, 520`) Same as before — one `SELECT` per group-scoped expense. Pre-fetch member group IDs into a `Set` and check in JS. This is the highest-leverage remaining perf fix.

**3.3 Missing indexes.** (`db/mysql.ts`) Add a single migration adding indexes on `expenses(group_id, transaction_date DESC)`, `expenses(created_by_user_id, transaction_date DESC)`, `group_members(email)`, `group_invitations(email, status)`, `settlement_payments(group_id, settled_at DESC)`, `audit_logs(entity_type, entity_id)`.

### Medium — still open

- **1.11** Email-as-identity for authorization keys (`expenses/service.ts:209-221`, `groups/service.ts:312-326, 780-791`).
- **1.13** Optional: FX conversion or per-currency subtotals for household/settlement/budget rollups when expenses mix currencies.
- **1.14** Optional: breached-password list (zxcvbn) or longer minimum length.
- **1.15** Login rate limiter still per-IP only.
- **1.18** `audit_logs.actor_email NOT NULL` while `actor_user_id NULL` (`db/mysql.ts:127-138`).
- **1.19** `/health` doesn't check DB.
- **2.1** `ImportPage.tsx` 2,631 lines; `BudgetPage.tsx` 1,340 lines. Apply the `useHouseholdPageState`-style split: extract `features/import/parseStatement.ts`, `features/import/columnMapping.ts`, `features/import/dateParse.ts`, `features/import/merchantRules.ts`, `features/import/sanitize.ts`, and `pages/import/useImportPageState.ts`. Same for budget.
- **2.2** Budgets, monthly assumptions, merchant rules, custom categories, column mappings — all in `localStorage`. Move user data (budgets, merchant rules) to the DB.
- **2.3** `listHouseholdSettlements` duplicates `listGroups`. Extract `loadGroupExpenses(groupIds, viewerEmail, viewerUserId)`.
- **2.4** `refetchQueries: [GET_EXPENSES]` per mutation (`useExpenseActions.ts:8, 12, 16`). The import flow fires this per row in a loop.
- **2.5** `ME` is `network-only`. With cookies, every page reload re-validates against the server. Move to `cache-first` and refetch on auth-mutation completion (already done) and on `visibilitychange` if you want freshness.
- **2.6** No `<ErrorBoundary>` — a throw in any descendant blanks the page.
- **3.4** `getDashboardStats` still hardcodes 65/35 + `'Active Groups: 3'` (`features/expenses/selectors/expenseAnalytics.ts:35-61`).
- **3.6** Replace `refetchQueries` with `update(cache, ...)` + fragments. Pair with §4 (extract `EXPENSE_FIELDS` fragment).
- **6.1** Adopt Zod for `expenses` and `groups` inputs the way `auth/validation.ts` formalized the auth side.
- **6.2** Generate types from the GraphQL schema with `@graphql-codegen/cli` to drop `client/src/features/*/types.ts`.
- **6.4** Split `AuthContext` into `<AuthStateContext>` and `<AuthActionsContext>` (`AuthContext.tsx:109-120`).
- **6.7** Add Vite/TS path aliases (`@/components`, `@/features`, etc.).

### Low / Nice-to-have — still open

- **1.21** `useEffect` mutates the first member from `user` in `useHouseholdPageState.ts:284-302` — minor.
- **4.5–4.13** Duplications mostly still present (see "Status of every previous finding"). Highest-impact: extract `EXPENSE_FIELDS` and `GROUP_FIELDS` GraphQL fragments; extract `mapExpenseRow` server-side.
- **5.2** Root `README.md`.
- **5.5** `server/.eslintrc.cjs` and a `lint` script.
- **5.7** `dependabot.yml` for npm across root/client/server.
- **5.8** `useId()` on auth form labels.
- **5.10** `audit_logs` retention plan.

---

## + New observations on the latest code

These are things I noticed in the new code that the previous review didn't cover.

### Medium

**1.A `ME` runs on every mount even without a session cookie.** (`AuthContext.tsx:43-50`)

The previous version conditionally skipped the `ME` query when `!hasStoredToken`. With cookies, the client can't see whether the user has a session, so the query is now unconditional. That's fine functionally — Apollo gets a `null` `me` and `RequireAuth` redirects to `/login` — but it adds one unnecessary GraphQL round-trip for every unauthenticated visitor. A pragmatic option: keep a non-sensitive `budgetshare_session=1` hint cookie (not httpOnly, no secret value, just a presence flag) alongside the real httpOnly tokens, so the client can `skip: !document.cookie.includes('budgetshare_session')`. This isn't a security regression (the flag is public) and it eliminates the round-trip for fresh visits.

**1.B Refresh-token revocation is all-or-nothing.** (`auth/service.ts:147-156`)

`revokeRefreshTokens` increments `users.refresh_token_version`, which invalidates **every** session for that user — laptop, phone, tablet. That's the right behavior for "logout from all devices" or "password reset," but the current `logout` resolver (`resolvers.ts:115-121`) does the same thing for a single-device logout. A user logging out on a public computer will silently invalidate their phone session. Either:
- Document this as intended ("logout = logout everywhere"), or
- Track individual refresh tokens server-side (a `refresh_tokens` table with a `jti`-keyed row per token, mark used/revoked on rotate) and only revoke the current one on logout. The version-bump path remains for "logout everywhere" and "password change."

**1.C Password change doesn't bump `refresh_token_version`.** No password-change mutation exists in the schema, but if/when one is added, it should call `revokeRefreshTokens` so existing sessions can't outlive a credential change.

**1.D Equality typo.** (`createApp.ts:17`)
```ts
if (!raw || raw.trim().length == 0) {
```
Use `===`. A `@typescript-eslint/eqeqeq` rule would catch this — another reason to add server-side ESLint (still open from §5.5).

**1.E DB credentials still have hardcoded fallbacks in code.** (`server/src/db/mysql.ts:7-8`)
```ts
user: process.env.DB_USER || 'budget_user',
password: process.env.DB_PASSWORD || 'budget_password',
```
`docker-compose.yml` now requires env vars (good), but the server itself silently falls back to these literals if `DB_USER`/`DB_PASSWORD` are unset. Fail fast instead:
```ts
const required = (name: string): string => {
  const v = process.env[name];
  if (!v?.trim()) throw new Error(`${name} must be set`);
  return v;
};
const user = isDevelopment ? (process.env.DB_USER ?? 'budget_user') : required('DB_USER');
```

**1.F `errorHandler.ts:29` exposes lower-status messages.**
```ts
const message = safeStatus === 500 ? 'Internal server error.' : err.message;
```
For 4xx errors, the raw `err.message` flows to the client. Mostly fine for `400`/`404`, but if a library throws a `403` carrying a stack-trace-ish message you'd leak it. Consider whitelisting acceptable 4xx messages or always rewriting from a code.

**1.G CSRF guard only applies when a session cookie is present.** (`graphqlCsrfGuard.ts:59`)
That's by design and the CSRF docs explain it — bearer-token clients (mobile, server-to-server) aren't subject to CSRF. Confirm this is the intended boundary; if you don't actually have a bearer-token flow in production, you could harden by always rejecting non-allowlisted origins on mutations regardless of cookie presence. Today, an attacker without a session cookie can still hit your GraphQL endpoint from any origin (CORS allows GETs to error, but POST mutations would 200 with an `Authentication required` error). That's correct GraphQL behavior; just be aware.

**1.H Test coverage skews to auth.** Auth/CSRF/cookies/request-id are well covered; the **money math** still has zero tests:
- `transactionDedup.ts` (the SHA-256 fingerprint that prevents double-imports).
- `expenses/service.ts toStoredSplitDetails` (the residual-to-last-allocation invariant).
- `groups/service.ts buildOptimizedTransfers` and `buildSettlementForScope`.

A regression in any of these silently corrupts user balances. Add a `server/src/modules/expenses/transactionDedup.test.ts` and a `server/src/modules/groups/settlements.test.ts` next (no DB needed for either — both are pure functions over inputs once you split them out).

### Low

**1.I `formatError` no longer scrubs internal errors.** (`createApp.ts:41-49`) Combines with 1.8/1.10 — the `requestId` stamp is great, but `extensions` doesn't get a sanitized `code` or a generic message for unknown failures.

**1.J `errorHandler.ts:13` is permissive.**
```ts
const statusCode = Number(err.statusCode ?? err.status ?? 500);
```
If a library attaches a malicious `statusCode = "1000"` string, `Number("1000") = 1000` (>= 400 passes the check), and the response goes out with `res.status(1000)` which Node will likely allow. Clamp to a known whitelist or `200 <= safeStatus < 600`.

**1.K Hard-coded `'Internal server error.'` is OK; consider including the `requestId`** so users can quote it in support tickets. The body already has `requestId`, but the `errors[0].message` doesn't.

**1.L Cookie path is `/graphql`.** (`cookies.ts:8`) Sensible. One implication: if you later add `/auth/refresh` or `/auth/logout` HTTP routes, the cookies won't be sent. Either widen the path then or stay GraphQL-only.

---

## Updated prioritized action list

The previous top-10 list is mostly done. Here's what's left, ordered by impact ÷ effort.

1. **Currency FX** (1.13 rest) — optional exchange-rate API for true cross-currency rollups.
2. **Settlement refetch** (6.2) — cache updates for `recordSettlementPayment` / period queries.
3. **Stronger password policy** (1.14) — optional HIBP/zxcvbn beyond static common-password list.
4. **Return `Group` from template/expense-group mutations** — avoid `refetchGroups` after boolean ops.

**Done recently:** email/user identity (#50, #56), budget per-currency (#54), `mapExpenseRow` + `GROUP_FIELDS` (#55), Dependabot (#53), common-password + cache-first `me` (#51), per-currency settlements (#49), group cache (#52, #57), audit `actor_user_id` NOT NULL.

Stretch: path alias `@/` in Vite (6.7), mutation payloads returning full `Group`.

---

## Bottom line

In ~10 days of commits you've closed every Critical finding from the previous review and most of the High ones. The remaining work is incremental: a few last security hardenings (`helmet`, error codes, kill hardcoded DB fallbacks), a perf cleanup pass (indexes + N+1), and structural cleanup (page splits, fragments, money-math tests). The infrastructure pieces that landed — CSRF guard, request IDs, structured logging, code splitting, batched inserts, real integration tests with MySQL in CI — are the kind of foundation that pays compounding interest. Keep going.

---

*Reviewed against `7a0586d` on disk. Every changed file in the 35-commit delta read directly; unchanged files cross-referenced against the prior review's findings.*

---

## Addendum — 6 commits since `7a0586d` (now at `c831627`)

Reviewed: `c831627 Add production Docker Compose stack for VPS deploy` (HEAD), `3ef999f`/`e2cfbf2` (Merge PRs #25/#24 `perf/email-retry-on-invitations`), `401d6e6 docs: add production deployment checklist`, `a0da838 perf(server): add bounded SMTP retries for invitation emails`, `ebeefd9 feat(server): email all new household members on group create`, `00ca594 feat(server): email invitations for new household members`.

Two themes: **transactional invitation email** and **production deploy stack**. Both are first-pass complete; comments below.

### What's working well

- **Email is opt-in via env config.** `getResolvedSmtpSettings()` (`server/src/modules/email/smtpConfig.ts:28-46`) returns `null` if any of `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` is missing, and `sendHouseholdInvitationEmails` logs `invitation_email_skipped` and returns without throwing (`sendHouseholdInvitations.ts:76-83`). DB invitation rows are still created either way — registration acceptance still works even if SMTP is unavailable.
- **HTML escaping on every interpolation.** `escapeHtml` (`sendHouseholdInvitations.ts:22-27`) covers `&`, `<`, `>`, `"`. Group name, actor email, invitee name, and URLs are all wrapped before going into the HTML body. No HTML injection if a malicious group name slips through name-validation upstream.
- **Bounded retry with exponential backoff.** `sendMailWithRetry` (`sendHouseholdInvitations.ts:42-60`): `SMTP_RETRY_MAX_ATTEMPTS` (default 3), `SMTP_RETRY_BASE_DELAY_MS` (default 300), backoff `base * 2^(attempt-1)`. Each attempt is logged with success/failure metadata. The retry loop is per-message, so a flaky SMTP doesn't poison the whole batch.
- **Fire-and-forget after DB commit.** `queueHouseholdInvitationEmails` / `queueNewGroupCreatedEmails` (`sendHouseholdInvitations.ts:142-154, 288-300`) intentionally don't `await` — the GraphQL mutation returns immediately and SMTP latency is decoupled from the API response. `void` + `.catch` swallows unhandled rejections into the structured logger.
- **Two distinct templates.** Pending invitees get "you're invited, register with this email so the invitation auto-accepts." Already-registered members get "you've been added, here's a login link." Avoids confusing existing users with a "create an account" CTA.
- **APP_PUBLIC_URL with sensible fallback.** `getPublicAppBaseUrl()` (`smtpConfig.ts:7-17`) prefers `APP_PUBLIC_URL`, falls back to the first `ALLOWED_ORIGINS` entry, then localhost. Strips trailing slashes. Makes invitation links point at the right place even if `APP_PUBLIC_URL` is forgotten.
- **Per-attempt log fields.** `invitation_email_sent` and `invitation_email_failed` carry `to`, `groupName`, `attempts`, `template` (and `message` on failure). Easy to grep when debugging delivery.
- **Three-tier production stack.** `docker-compose.prod.yml`: MySQL (no host port — only on the internal network), API (built from `server/Dockerfile`), and nginx (`deploy/Dockerfile.nginx`) serving the SPA bundle and proxying `/graphql` and `/health` to the API. Only port 80 is published.
- **Multi-stage Dockerfiles.** Server (`server/Dockerfile`): builder installs all deps + compiles TS, runner does `npm ci --omit=dev` + copies `dist`, drops to the unprivileged `node` user with `chown`. Nginx (`deploy/Dockerfile.nginx`): client build happens inside, only `client/dist` ships into nginx. No dev tooling in the final images.
- **Same-origin GraphQL by default.** `VITE_GRAPHQL_URL` defaults to `/graphql` in the nginx image (`Dockerfile.nginx:7-8`), so the SPA hits its own origin and cookies + CSRF + CORS all "just work" without extra config.
- **nginx forwards proxy headers.** `proxy_set_header X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, `Host` are all set (`deploy/nginx/default.conf:13-16, 22-25`), which is what `TRUST_PROXY=1` (set in `docker-compose.prod.yml:43`) needs for rate-limit correctness.
- **`DEPLOYMENT_CHECKLIST.md`** is operationally complete: env-var table, smoke-test plan, security checks (httpOnly+SameSite+Secure verification), observability check (request id end-to-end), rollback note.

### Issues (new)

#### High

**A.1 SMTP credentials are passed to the API container via `${MYSQL_USER}`-style direct env, but SMTP_* aren't listed in `docker-compose.prod.yml`.** (`docker-compose.prod.yml:40-48`)

The `api` service declares `env_file: - path: .env, required: false` and explicit `DB_*` / `NODE_ENV` keys, but no `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM`/`APP_PUBLIC_URL`/`ALLOWED_ORIGINS`/`JWT_*` lines. Because `env_file` loads `.env` keys into the container's environment, this works **only if `.env` contains those keys with the exact names the app expects** (it does — see `.env.example`). Subtle gotcha: anyone who copies `.env.example` and uncomments only the `MYSQL_*` block will be silently missing JWT secrets and SMTP, and the API will crash at boot (JWT) or skip email (SMTP) without it being obvious from the compose file. Two cleanups:

1. Add an explicit warning at the top of `docker-compose.prod.yml`: "the `.env` file must also set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ALLOWED_ORIGINS`, `APP_PUBLIC_URL`, and optionally `SMTP_*` — these are loaded into the API via `env_file`."
2. Make `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` explicit in the `environment:` block with `${...:?required}` syntax so docker compose fails fast at `up` time if they're missing — same pattern already used for `MYSQL_*`.

**A.2 The fire-and-forget pattern hides delivery failures from the user.** (`sendHouseholdInvitations.ts:142-154`)

`queueHouseholdInvitationEmails` returns immediately. The GraphQL `createGroup` / `updateGroup` mutation completes successfully even if every email subsequently fails. From the actor's UI, "you've invited Alice" looks identical to "you tried to invite Alice but the email bounced." That's a deliberate design choice (decouple HTTP latency from SMTP), and the right one — but you need a way to surface persistent failures. Two paths:

1. **Cheap:** Add an `email_status` column to `group_invitations` (`pending_email | email_sent | email_failed | email_skipped`). Write `email_failed` from the catch path; expose to the actor in `myInvitations` so they can see who didn't receive their email and resend manually. ~A few hours.
2. **Proper:** Persist invitation-email attempts in a `notification_outbox` table, return immediately, run a separate worker (or `setInterval` retry loop) that picks up failed rows and retries with longer backoffs over days. Doable later; for now path 1 is enough.

#### Medium

**A.3 Two near-identical email-template blocks.** (`sendHouseholdInvitations.ts:97-138` vs `195-242`)

`sendHouseholdInvitationEmails` and the "pending invitees" loop inside `sendNewGroupCreatedEmails` build the same subject, text body, and HTML body for the **invitee** case. Extract `buildInvitationEmail(invitee, baseUrl, groupName, actorEmail): EmailPayload` and reuse. Same for the existing-member template. Easy win: drops ~50 lines of duplication.

**A.4 Plain-text body interpolates unsanitized values.** (`sendHouseholdInvitations.ts:99-113`)

```ts
const text = [
  `Hi ${invitee.name},`,
  ...
  `Invited by: ${actorEmail}`,
  ...
].join('\n');
```

HTML is escaped, but the plain-text body isn't. If `groupName` or `invitee.name` contain a newline they can manipulate the email's plain-text body (e.g. fake "Reply-To:" lines if read by a naive mail client). Realistic risk is low — both are stored after `.trim()` and the upstream validation rejects control characters in `auth/validation.ts`. But `groupName` isn't sanitized that way upstream (`groups/service.ts:430 const name = input.name.trim();`). Strip control chars from `groupName` and `name` before interpolating into the plain-text body. While there, do the same for `actorEmail` (which goes through `normalizeEmail` and is regex-validated, so probably already fine).

**A.5 `escapeHtml` doesn't cover single quotes.** (`sendHouseholdInvitations.ts:22-27`)

Standard list: `&`, `<`, `>`, `"`, `'`. The current escape map omits `'`. Today the HTML template uses double quotes around attributes so a stray apostrophe doesn't escape — but if someone ever switches an attribute to single quotes, an apostrophe in `groupName` could close the attribute. Add the rule for completeness:
```ts
.replace(/'/g, '&#39;')
```

**A.6 SMTP transporter is created per call.** (`sendHouseholdInvitations.ts:86-91, 184-189`)

`nodemailer.createTransport(...)` runs every time `sendHouseholdInvitationEmails` is invoked. Nodemailer transporters maintain a connection pool internally, so creating one per batch means re-handshaking with the SMTP server. For low volume this is fine; if invitation traffic grows, lift the transporter into a module-level lazy singleton (`let transporter: nodemailer.Transporter | null = null; ... if (!transporter) transporter = createTransport(...)`). Reset on SIGTERM.

**A.7 nginx config lacks security headers.** (`deploy/nginx/default.conf`)

`server_tokens off` and `gzip` are set. Missing: `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a basic `Content-Security-Policy`. These belong at the nginx layer (or via `helmet` on the API — still open from main review **1.16**). Add to the `location /` block:
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```
(The HSTS line should only be enabled once you've confirmed HTTPS terminates at this nginx — if you sit behind another reverse proxy that handles TLS, do this there instead.)

**A.8 `proxy_pass` on `/graphql` and `/health` is duplicated.** (`deploy/nginx/default.conf:10-26`)

Five header lines repeated verbatim across the two locations. Use an include or hoist into the `server` block:
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_http_version 1.1;

location /graphql { proxy_pass http://api:4000/graphql; }
location /health  { proxy_pass http://api:4000/health; }
```

**A.9 No client cache headers on built assets.** (`deploy/nginx/default.conf:28-30`)

The SPA bundles are content-hashed by Vite (`/assets/index-abc123.js`), so they're safe to cache forever. nginx's defaults give them no cache control. Add:
```nginx
location ~* \.(?:css|js|woff2?|ttf|png|jpg|jpeg|svg|gif|ico)$ {
  expires 1y;
  add_header Cache-Control "public, immutable";
  try_files $uri =404;
}
location = /index.html {
  add_header Cache-Control "no-store";
}
```

#### Low

**A.10 `sendNewGroupCreatedEmails` cannot share retry attempts across the two loops.** (`sendHouseholdInvitations.ts:195-285`)

Both loops in `sendNewGroupCreatedEmails` (pending invitees, then existing members) call `sendMailWithRetry` independently. If SMTP is having a bad time, the first loop hits its `SMTP_RETRY_MAX_ATTEMPTS * baseDelay * 2^N` budget per recipient, then the second loop does the same. For a group of 5+ pending + 5+ existing, a 503'd SMTP can stall the worker for minutes. Acceptable for fire-and-forget, but consider adding a circuit-breaker (after N consecutive failures, skip remaining sends and log `invitation_email_circuit_open`).

**A.11 Email body wording.** Minor: "You've been added as a member of the household *...*" — "the household" reads strangely when the group name already starts with "The". Cheap fix: drop "the".

**A.12 Bcrypt 72-byte cap applies to UTF-8 bytes, not characters.** (Not new in this batch — flagged for the record now that emails are in scope.) `auth/validation.ts:43` caps at 72 *characters*, but bcrypt truncates at 72 *bytes*. A user with a long non-ASCII password may have it silently truncated before the cap kicks in. Cap on `Buffer.byteLength(password, 'utf8')` instead.

**A.13 `Dockerfile` `EXPOSE 4000` but compose sets `PORT=4000`.** (`server/Dockerfile:18`, `docker-compose.prod.yml:42`)

Fine, but the API code reads `PORT` from env (`server/src/index.ts:3`). If someone changes `PORT` in compose, `EXPOSE` is now stale. Make the Dockerfile env-driven: `EXPOSE ${PORT:-4000}` won't work (EXPOSE doesn't interpolate at run time), so the simplest thing is to keep this in sync via convention and add a comment.

**A.14 No body-content sniffing on `Content-Type` in nginx.** Optional: add `client_max_body_size 1m;` to the `server` block so oversized POSTs hit nginx's 413 instead of being proxied to the API, which has its own `JSON_BODY_LIMIT=512kb`. Defense-in-depth.

### Status update on the previous review's still-open items (no change unless noted)

The 6-commit delta did not touch: N+1 `isGroupMember`, missing DB indexes, `extensions.code` error enum, `refetchQueries` pattern, page-file splits, helmet, AuthContext split, money-math tests, root README, server ESLint, `db/mysql.ts` hardcoded fallbacks. Those remain the top of the prioritized list.

### Updated prioritized action list

The previous top-10 stands as-is. Inserting the new items at the cadence the user is actually shipping:

11. **Make JWT and SMTP env keys explicit and required in `docker-compose.prod.yml`** (A.1). ~10 minutes. Prevents silent boot-with-defaults in prod.
12. **Record per-invitation email status in DB** (A.2). Adds visibility for delivery failures. ~A few hours.
13. **Add nginx security headers + cache headers** (A.7, A.9). ~10 minutes.
14. **Extract `buildInvitationEmail` helper** (A.3). ~Half an hour.
15. **Strip control chars from plain-text interpolations** (A.4). ~10 minutes.

### Bottom line on this batch

The email feature is well-structured (config-gated, retried, logged, decoupled from the request) and the production stack is a reasonable single-VPS setup. The cleanups above are small. The bigger items from the main review still warrant priority — especially indexes and `extensions.code`, both of which would compose nicely with this deploy work.

---

*Updated: reviewed `c831627` against `7a0586d`. Every new and modified file in the 6-commit delta read directly.*
