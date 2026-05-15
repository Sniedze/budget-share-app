# Budget Share

Household expense sharing app (React + GraphQL API + MySQL).

## Layout

- `client/` — Vite + React SPA
- `server/` — Express + Apollo GraphQL API
- `docker-compose.yml` — local MySQL only
- `docker-compose.prod.yml` — production stack (MySQL + API + Caddy)

## Local development

1. Copy `.env.example` to `.env` and set `MYSQL_*`.
2. Start MySQL: `docker compose up -d`
3. Server: `cd server && npm ci && npm run dev`
4. Client: `cd client && npm ci && npm run dev`

See `.env.example` for JWT, CORS, SMTP, and client `VITE_GRAPHQL_URL`.

## Production deploy

See `DEPLOYMENT_CHECKLIST.md` and `SECURITY.md`.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Requires `.env` with `MYSQL_*`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `ALLOWED_ORIGINS`.

## Tests

```bash
cd server && npm test
```
