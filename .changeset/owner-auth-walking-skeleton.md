---
'@repo/api': minor
'@repo/web': minor
---

Owner-based access for individual accounts (ADR-0016) and the auth walking skeleton.

- **API:** Better Auth wired end-to-end — users/sessions/accounts/verifications schema + initial migration, open email/password signup at `/api/auth/*`, session validation in the authentication guard, and a protected `GET /api/v1/me`. The organisation RBAC layer (permissions guard/decorator, membership model) is replaced by service-level ownership checks; other users' resources return the same 404 as missing ones. Health probes moved to `/health` (version-neutral) so container healthchecks work.
- **Web:** first entry point — TanStack Router (file-based, auth-guarded layout) + TanStack Query, RHF + Zod forms on a shared accessible Form primitive, shadcn/ui-style token-driven primitives, light/dark/system theme, and sign-up/sign-in/sign-out pages with a protected home. The bundle calls the API on relative `/api` paths; nginx in the web image proxies to the API service, so one immutable image runs in every environment (no more `VITE_API_URL` build arg).
- **Deploy:** `docker-compose.prod.yml` runs pinned GHCR images behind your own reverse proxy (single exposed port, Postgres internal-only, required secrets) with a one-shot `prisma migrate deploy` service; the dev compose gains the same migration step.
