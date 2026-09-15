---
'@repo/api': minor
'@repo/web': minor
---

Close public sign-up by default and manage accounts without email (ADR-0018).

- **API:** `AUTH_SIGNUP_ENABLED` (default `false`) makes Better Auth refuse sign-up. New public `GET /api/v1/config` tells the web client whether sign-up is available.
- **Accounts:** `pnpm user:create` and `pnpm user:reset-password` (or `node dist/cli/user.js …` in the api container) create accounts and reset passwords with Better Auth's hashing; a reset signs out existing sessions.
- **Development:** `pnpm db:seed` (run by `setup.sh`) creates `dev@example.com` / `dev-password-123`; it refuses to run in production.
- **Web:** the sign-in page offers sign-up only when enabled, and `/sign-up` redirects to sign-in otherwise.
