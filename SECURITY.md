# Security Policy and Risk Register

## Dependency Audit Baseline

- Client (`client`): `npm audit --omit=dev` reports `0` vulnerabilities.
- Server (`server`): `npm audit --omit=dev` reports `3` moderate vulnerabilities.

## Accepted Temporary Risk

- Advisory: [`GHSA-w5hq-g745-h8pq`](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
- Package chain: `uuid` (transitive via `@apollo/server` and `@as-integrations/express5`)
- Current status: `fixAvailable: false` from npm audit
- Decision: accepted temporarily until upstream publishes a fix
- Mitigation:
  - Keep `@apollo/server` and `@as-integrations/express5` at latest compatible versions.
  - Re-run production audit regularly and before each release.
  - Upgrade immediately when a fix becomes available.

## Runtime Security Requirements

- **Observability:** Every HTTP request gets an `x-request-id` (incoming value is preserved if provided, otherwise generated). Request and error logs include this id for incident correlation.
- Node.js version: `>=20` (enforced via `engines` and `.nvmrc`)
- JWT secrets must be explicitly set outside development:
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`
- **Sessions:** Access and refresh JWTs are issued as **httpOnly** cookies on the `/graphql` path (`SameSite=Lax`, `Secure` in production). The browser must send `credentials: 'include'` on API requests (the SPA does this). **Logout** increments `users.refresh_token_version` so existing refresh JWTs stop working; access JWTs remain valid until they expire (short TTL by default).
- **CORS:** The API uses an allowlist (`ALLOWED_ORIGINS`, comma-separated). If unset, only common **local** dev origins are allowed. Production deployments **must** set `ALLOWED_ORIGINS` to the real web app URL(s) and use HTTPS. `credentials: true` is enabled for cookie-based auth; keep origins explicit.
- **CSRF:** Cookie-authenticated GraphQL **mutations** require an allowed `Origin` header (or `Referer` origin fallback). Requests with session cookies from non-allowlisted origins are rejected with HTTP 403.
- **Request size:** JSON bodies are capped via `JSON_BODY_LIMIT` (default `512kb`) to limit oversized GraphQL payloads.
- **Query abuse guard:** Apollo `maxRecursiveSelections` is enabled via `GRAPHQL_MAX_RECURSIVE_SELECTIONS` (default `30`) to curb deeply-recursive GraphQL operations.

## Environment template

- See **`.env.example`** at the repo root for variable names used by Docker Compose, the server, and the Vite client (`VITE_GRAPHQL_URL`).

## CI Gate Recommendation

- Use `server` security gate command:
  - `npm run audit:gate`
- Behavior:
  - Fails on `high` or `critical` vulnerabilities.
  - Allows current low/moderate baseline while this accepted risk remains open.
- Use advisory status checker:
  - `npm run audit:check-known`
  - Reports whether `GHSA-w5hq-g745-h8pq` is still present in audit output.

## Import Pipeline Security

- Scope:
  - Bank statement import currently supports local CSV/TXT files in the client.
  - No raw statement files are uploaded or stored server-side.
- Data handling:
  - Parsing is performed in-browser and only approved rows are sent as expense mutations.
  - Import batches do not persist original file content.
- Input guardrails:
  - Allowed file types: `.csv`, `.txt` (with MIME checks).
  - Maximum file size: `2MB`.
  - Maximum parsed data rows: `1000`.
- Injection hardening:
  - Imported text is sanitized to strip control characters.
  - Spreadsheet formula-leading values (`=`, `+`, `-`, `@`) are neutralized by prefixing before use.
- Authorization and access:
  - Imported expenses use the same authenticated GraphQL mutations and user-scoped authorization as manual entry.
- Failure behavior:
  - Imports are processed row-by-row with partial-failure reporting.
  - Successful rows are committed; failed rows remain for review and correction.
