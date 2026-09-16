# Backlog

Candidate work that is **not yet scheduled** — one line per item, with a rough
size (S/M/L). Scheduled work is in PRODUCT.md's
[Now / Next / Later](PRODUCT.md#roadmap); known shortcuts are in
[TECH_DEBT.md](TECH_DEBT.md).

Claude updates this file in the PR that finishes or schedules an item: delete a
finished item; move a scheduled one to PRODUCT.md.

- `S` Lint PR titles in CI with commitlint (squash-merge titles skip the local
  hook); Dependabot's `chore(deps-dev)` prefix must pass the scope list.
- `S` Automated contrast check of the design tokens in `globals.css` (every
  fill/foreground pair meets WCAG AA in light and dark).
- `M` Extend `pnpm gen:feature` to scaffold the frontend side (`api/` hooks on
  `apiClient`, list route, form) so the web pattern is generated and CI-verified.
- `S` Review the template's indexes with database-architect: `@@index([ownerId])`
  is a prefix of `@@index([ownerId, status])`, and lists order by `createdAt`.
- `M` Enforce the soft-delete filter globally with a Prisma client extension once
  a second model exists.
- `S` Tune per-route rate limits for sensitive endpoints as they appear.
- `S` Bundle-size budget check for the web app in CI.
- `S` Load Inter (self-hosted `woff2`, preloaded) or drop it from `--font-sans`
  (DESIGN_SYSTEM.md → Typography).
- `S` Measure `--border`, `--input` and `--sidebar-border` against WCAG 1.4.11
  in both themes and retune them (ACCESSIBILITY.md).
- `S` `Button` pending state (spinner, `disabled`, `aria-busy`) replacing
  label-swapping in forms.
- `S` Error summary in the `Form` primitive, linking each failure to its field.
- `S` Unify the focus ring: `Button` and `Input` use different ring/offset
  classes (DESIGN_SYSTEM.md → Focus ring).
- `S` Drop the unsupported webkit project from `apps/web/playwright.config.ts`.
- `S` A keyboard-only Playwright journey through sign-in, a tool and sign-out,
  and a 400%-zoom reflow check on every screen (the app shell has both).
- `S` Restore endpoint in the reference template so undo toasts can reverse a
  soft delete.
- `S` Cross-tab sign-out and theme sync (`BroadcastChannel` or `storage` event).
- `S` Report client errors (root and route boundaries) to the API log.
- `S` Dependency licence check in CI.
- `S` Structured validation `details` (`{ field, code, message }[]`) from the
  exception filter, replacing today's `string[]` (API.md).
- `S` Pagination: optional `meta.total` and a maximum `limit` of 200 in
  `PaginationQueryDto` (today 100).
- `S` Transaction-capable repositories in the reference template: an optional
  `db: Prisma.TransactionClient` on each method (DATABASE.md → Transactions).
- `S` A `Clock` provider and a fixed clock for tests (DATABASE.md → Time).
- `S` Idempotent create with an optional client UUID v7 `id` in the reference
  template (API.md).
- `S` Shared API e2e helpers `createTestApp()` and `signInAs()` in
  `apps/api/test/helpers/`.
- `S` Fail the CI e2e job when `DATABASE_URL` is missing instead of skipping
  every suite.
- `S` Scope the template e2e cleanup to its test users instead of
  `deleteMany()` on the whole table.
- `S` A runtime database role with data-only privileges for `api`, separate from
  the `migrate` role (TECH_DEBT.md).
- `S` Check the Nest throttler default (100 requests/60 s per IP) against a busy
  desktop session and tune `RATE_LIMIT_*`.
- `S` Log auth security events (OBSERVABILITY.md) and bring `/api/auth/*` into
  the request log — Better Auth is mounted before `nestjs-pino` today. Required
  before exposure.
- `S` Regression test that Swagger UI (`/api/docs`) is not served in production.
- `S` `/health/ready`'s 503 body: the exception filter replaces Terminus's
  per-check detail with `{"error":{"code":"ERROR",…}}`. Map 503 to a
  `SERVICE_UNAVAILABLE` code, or let health responses through unchanged.
- `S` Proxied API responses carry each security header twice, from Helmet and
  from nginx, and two disagree (`X-Frame-Options` `SAMEORIGIN`/`DENY`,
  `Referrer-Policy` `no-referrer`/`strict-origin-when-cross-origin`); add the
  nginx copy only when the upstream sent none.
- `S` Container hardening in `docker-compose.prod.yml`: `no-new-privileges`,
  `cap_drop: [ALL]`, `read_only` with tmpfs, `init: true`, memory limits; and
  `nginxinc/nginx-unprivileged` for the web image.
- `S` Make `web` depend on `api` with `condition: service_healthy`, so nginx
  doesn't answer 502 while the API starts.
- `S` Pass `RATE_LIMIT_TTL`, `RATE_LIMIT_LIMIT` and `AUTH_RATE_LIMIT_ENABLED`
  through `docker-compose.prod.yml` so the server can tune them without editing
  the file.
- `S` Dependabot `docker-compose` ecosystem for `postgres:17-alpine` in both
  compose files, ignoring majors (a PostgreSQL major is a dump-and-restore,
  OPERATIONS.md).
- `S` Workflows: `node-version-file: .nvmrc` instead of hard-coded `24`, and
  `timeout-minutes` on every job.
- `S` Web source maps: `build.sourcemap: 'hidden'` so the image doesn't serve
  `.map` files publicly.
- `S` A pre-migration `pg_dump` step in the upgrade path (scripted, not only the
  manual step in OPERATIONS.md → Routine upgrade).
- `S` Pin the compose network subnet in `docker-compose.prod.yml`, or keep
  documenting `AUTH_TRUSTED_PROXIES` for Docker pools from `192.168.0.0/16`
  (OPERATIONS.md → Reverse proxy).
- `S` Decide GHCR package visibility for `workhub/api` and `workhub/web`
  (recommended: public — DECISIONS.md, 2026-09-16).
- `S` CI smoke test of `docker-compose.prod.yml`: boot the built images and
  request `/api/v1/config` through nginx (alongside the Docker build in
  PRODUCT.md's Next list).
- `S` Rename the root `package.json` from `blank-app` to `workhub`.
