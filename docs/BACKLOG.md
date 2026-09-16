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
- `S` Measure `--border` and `--input` against WCAG 1.4.11 in both themes and
  retune them (ACCESSIBILITY.md).
- `S` `Button` pending state (spinner, `disabled`, `aria-busy`) replacing
  label-swapping in forms.
- `S` Error summary in the `Form` primitive, linking each failure to its field.
- `S` Unify the focus ring: `Button` and `Input` use different ring/offset
  classes (DESIGN_SYSTEM.md → Focus ring).
- `S` Widen `app-shell.tsx` beyond `max-w-5xl` using the layout width tokens.
- `S` Remove the `hidden sm:inline` phone breakpoint on the account email in
  `routes/_authed.tsx` (hides content at 400% zoom).
- `S` Drop the unsupported webkit project from `apps/web/playwright.config.ts`.
- `S` Keyboard-only and 400%-zoom reflow Playwright journeys.
- `S` Restore endpoint in the reference template so undo toasts can reverse a
  soft delete.
- `S` Cross-tab sign-out and theme sync (`BroadcastChannel` or `storage` event).
- `S` Report client errors (root and route boundaries) to the API log.
- `S` Dependency licence check in CI.
- `S` **Bug:** validate the list `cursor` and map Prisma `P2023` to a 4xx — a
  malformed cursor reaches Prisma and returns 500 today (API.md → Lists).
- `S` **Bug:** map Express's `PayloadTooLargeError` to 413 — a body over 100 kB
  returns 500 today (API.md → Payload limits).
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
- `S` Proxy `/health/ready` through the web nginx so an external uptime monitor
  can reach readiness (today it gets the SPA's `index.html` with 200).
- `S` Regression test that Swagger UI (`/api/docs`) is not served in production.
