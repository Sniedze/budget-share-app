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
