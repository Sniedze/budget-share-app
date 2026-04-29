# Project Rules Checklist

Use this checklist for every new feature and PR.

## 1) Code Style

- Prefer arrow functions for components, hooks, handlers, and helpers.
- Use TypeScript strict typing; avoid `any`.
- Keep functions small and focused.
- Use clear naming (`expenses`, `updateExpense`, `CreateExpenseInput`).
- Keep comments minimal and only for non-obvious logic.

## 2) Frontend (React + Apollo)

- Use function components with hooks.
- Use Apollo for server state; avoid duplicating query data in local state.
- Use local `useState` only for UI/form state.
- Keep GraphQL operations close to feature code or dedicated hooks.
- Keep UI styling consistent with `styled-components`.

## 3) Backend (GraphQL + Express + MySQL)

- Keep resolvers thin; put business logic in services.
- Keep SQL parameterized (`?` placeholders), never string-concatenate input.
- Keep schema and resolver types aligned.
- Prefer small, safe schema migrations.
- Keep modules feature-oriented (`modules/expenses/...`).

## 4) Git Workflow

- One feature = one commit (small, reviewable).
- Do not mix unrelated changes in one commit.
- Commit only required files (including relevant lockfiles).
- Use clear commit prefixes:
  - `feat(client): ...`
  - `feat(server): ...`
  - `fix(...): ...`
  - `refactor(...): ...`

## 5) Quality Gate Before Commit

- Run build/type-check for touched app(s).
- Verify main user flow manually.
- Confirm no obvious lint/format issues.
- Confirm changed files match commit intent.

## 6) Current Team Preferences

- Prefer modern, stable practices over experimental patterns.
- Prefer arrow functions consistently.
- Prefer small commits for each added feature.

## 7) Security Baseline

- Follow `SECURITY.md` for accepted risk tracking and mitigation.
- Use Node `>=20` for local and CI environments.
- For server dependency checks, run:
  - `cd server && npm run audit:gate`
- The audit gate must block any `high` or `critical` vulnerabilities before merge.
