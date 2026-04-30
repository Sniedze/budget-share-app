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

- Node.js version: `>=20` (enforced via `engines` and `.nvmrc`)
- JWT secrets must be explicitly set outside development:
  - `JWT_ACCESS_SECRET`
  - `JWT_REFRESH_SECRET`

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
