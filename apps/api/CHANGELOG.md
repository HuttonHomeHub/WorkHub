# @repo/api

## 0.2.0

### Minor Changes

- [#14](https://github.com/HuttonHomeHub/WorkHub/pull/14) [`4cdf58f`](https://github.com/HuttonHomeHub/WorkHub/commit/4cdf58fcc749b788fb3dc2d6cea6f9d021c1f493) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Close public sign-up by default and manage accounts without email (ADR-0018).
  
  - **API:** `AUTH_SIGNUP_ENABLED` (default `false`) makes Better Auth refuse sign-up. New public `GET /api/v1/config` tells the web client whether sign-up is available.
  - **Accounts:** `pnpm user:create` and `pnpm user:reset-password` (or `node dist/cli/user.js …` in the api container) create accounts and reset passwords with Better Auth's hashing; a reset signs out existing sessions.
  - **Development:** `pnpm db:seed` (run by `setup.sh`) creates `dev@example.com` / `dev-password-123`; it refuses to run in production.
  - **Web:** the sign-in page offers sign-up only when enabled, and `/sign-up` redirects to sign-in otherwise.

- [#65](https://github.com/HuttonHomeHub/WorkHub/pull/65) [`834ca1e`](https://github.com/HuttonHomeHub/WorkHub/commit/834ca1e64f2f8a9a5968824b926fbaac6e4770f3) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Converting a week's excess now works in **whole blocks**, to match a timesheet filled in by the half hour. With the switch on, only whole blocks of the week's excess become TOIL and overtime, taken a block at a time from the days furthest over their target; minutes that don't make a whole block **stay as flexi**. For example, an excess of 2:45 converts 2:30, and 0:15 stays in your flexi balance. The block is a new work terms setting, **Conversion block** under Settings → Terms → Limits, 0:30 by default (any length from 0:01 to 8:00, effective from the Monday the terms start). The week view's This week panel says when some of the excess stays as flexi ("0:15 stays as flexi"), and "Less than one block (0:30) to convert" when the excess is under one block. Existing terms take the 0:30 default, so weeks that are already converted may show slightly different daily figures (for example, the worked-example Tuesday converts 2:00 instead of 1:50); the week's TOIL and overtime totals only change where the excess wasn't a whole number of blocks. The upgrade adds one database column; no action is needed.

- [#61](https://github.com/HuttonHomeHub/WorkHub/pull/61) [`f37def7`](https://github.com/HuttonHomeHub/WorkHub/commit/f37def7f997f68db415b313bb34fd3962761b23b) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Add `pnpm data:export --email <owner>`, which writes all of an owner's data to a JSON file readable by them only (inside the api container: `node dist/cli/data-export.js --email <owner> --out /tmp/export.json`). The export is not a backup; automated backups are still to come.

- [#58](https://github.com/HuttonHomeHub/WorkHub/pull/58) [`dc3c8f2`](https://github.com/HuttonHomeHub/WorkHub/commit/dc3c8f298196702fecfa02620df3674d445d4896) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Add the hours tracker's settings API: effective-dated work terms, leave years, time adjustments and public holidays, with a one-step import of the England and Wales bank holidays for a year (2019–2040). The release includes a database migration that adds four tables; take a `pg_dump` before upgrading, as the routine upgrade does.

- [#60](https://github.com/HuttonHomeHub/WorkHub/pull/60) [`908cd6b`](https://github.com/HuttonHomeHub/WorkHub/commit/908cd6b42dc8802acba376228080052ed5fefcc1) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Add the hours tracker's computed summaries (totals by day, week or month for a date range) and balances (flexi, this month's TOIL, leave remaining and this year's overtime).

- [#59](https://github.com/HuttonHomeHub/WorkHub/pull/59) [`7f30a60`](https://github.com/HuttonHomeHub/WorkHub/commit/7f30a607b26e97abd846c241d2cfc80374be535a) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Add the hours tracker's work days API (one start, end, break, leave and TOIL taken per date, with night shifts and the rules on leave, bank holidays and overlapping shifts) and the weekly "convert this week's excess" switch. The release includes a database migration that adds two tables; take a `pg_dump` before upgrading, as the routine upgrade does.

- [`9ccad82`](https://github.com/HuttonHomeHub/WorkHub/commit/9ccad82e1968f90eefa5268832d3236c3f893980) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Owner-based access for individual accounts (ADR-0016) and the auth walking skeleton.
  
  - **API:** Better Auth wired end-to-end — users/sessions/accounts/verifications schema + initial migration, open email/password signup at `/api/auth/*`, session validation in the authentication guard, and a protected `GET /api/v1/me`. The organisation RBAC layer (permissions guard/decorator, membership model) is replaced by service-level ownership checks; other users' resources return the same 404 as missing ones. Health probes moved to `/health` (version-neutral) so container healthchecks work.
  - **Web:** first entry point — TanStack Router (file-based, auth-guarded layout) + TanStack Query, RHF + Zod forms on a shared accessible Form primitive, shadcn/ui-style token-driven primitives, light/dark/system theme, and sign-up/sign-in/sign-out pages with a protected home. The bundle calls the API on relative `/api` paths; nginx in the web image proxies to the API service, so one immutable image runs in every environment (no more `VITE_API_URL` build arg).
  - **Deploy:** `docker-compose.prod.yml` runs pinned GHCR images behind your own reverse proxy (single exposed port, Postgres internal-only, required secrets) with a one-shot `prisma migrate deploy` service; the dev compose gains the same migration step.

- [#13](https://github.com/HuttonHomeHub/WorkHub/pull/13) [`bcbffed`](https://github.com/HuttonHomeHub/WorkHub/commit/bcbffedec011a3468ed6897792dbf771dd796c73) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Tidy the base repository.
  
  - **Security:** sign-in/sign-up rate limits now apply per client behind reverse proxies (`AUTH_TRUSTED_PROXIES`, `AUTH_RATE_LIMIT_ENABLED`); previously every client shared one bucket in production. Display-name length is enforced by the API, not only the form.
  - **Contracts:** `@repo/types` is a built contract package with shared account rules and API types generated from the committed OpenAPI contract (`pnpm contract:generate`, ADR-0017). The OpenAPI spec now documents the `{ data, meta }` envelope. The web calls the API through a typed `apiClient`; the home page loads `GET /api/v1/me`.
  - **Features:** `pnpm gen:feature <entity>` generates a backend feature from the reference template; CI verifies the output, including its API e2e test. The template's model now has a real `owner` foreign key.
  - **Runtime & tooling:** Node 24 LTS; a dev container for Codespaces; the api Docker image builds again (pnpm 10 deploy); `pnpm docs:check` guards the docs.

### Patch Changes

- [#45](https://github.com/HuttonHomeHub/WorkHub/pull/45) [`d95a15b`](https://github.com/HuttonHomeHub/WorkHub/commit/d95a15bd65e56bac1c735fa05b3551ebe04856ef) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - A malformed list cursor now returns 400 instead of 500, and a request body over the size limit returns 413 `PAYLOAD_TOO_LARGE` instead of 500, with a correlation id in the response and the log. The web container now proxies `/health` and `/health/ready` to the API, so an uptime monitor can check readiness through the site, and static assets keep the security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`).

- [#41](https://github.com/HuttonHomeHub/WorkHub/pull/41) [`fe34219`](https://github.com/HuttonHomeHub/WorkHub/commit/fe342193f3099b891c6d067a537e3b3d3046f035) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Update runtime dependencies: nestjs-pino 5.2, helmet 8.3, zod 4.6, lucide-react 1.46, TanStack Router 1.170 and Radix Slot 1.3.

- [#55](https://github.com/HuttonHomeHub/WorkHub/pull/55) [`7f5705c`](https://github.com/HuttonHomeHub/WorkHub/commit/7f5705cdab666df80cee5d7784a1efb2eb25c9dd) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Update runtime dependencies: NestJS 11.2.5, @nestjs/throttler 6.7 (rate limiting now groups IPv6 clients by /64, so rotating addresses within one allocation no longer evades the limit), TanStack Query 5.103, TanStack Router 1.170.38, tailwind-merge 3.7 and lucide-react 1.47.

- [#29](https://github.com/HuttonHomeHub/WorkHub/pull/29) [`a787339`](https://github.com/HuttonHomeHub/WorkHub/commit/a787339f353ca29edd2fc7e1b02f50b7be0a35af) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Only trust forwarded client addresses from configured proxies; reject placeholder auth secrets in production.
  
  - **Rate limiting:** the API honours `X-Forwarded-For` only from the proxies listed in `AUTH_TRUSTED_PROXIES`, so a client can no longer pick its own address (and rate-limit bucket).
  - **Configuration:** in production `BETTER_AUTH_SECRET` must be at least 32 characters and must not be a placeholder (for example the `.env.example` value); the API refuses to start otherwise.

- [#16](https://github.com/HuttonHomeHub/WorkHub/pull/16) [`fcf4dc4`](https://github.com/HuttonHomeHub/WorkHub/commit/fcf4dc4050e1376baab9ebdb9e61420e4f57cf09) Thanks [@HuttonHomeHub](https://github.com/HuttonHomeHub)! - Sign-in now says "Wrong email or password" only when the credentials really are wrong (401). Rate limiting gets its own message, and other failures — such as a request from an untrusted origin — show a neutral "couldn't sign you in" message instead of blaming the password. The default trusted origins also include `https://localhost:5173`, which VS Code port forwarding can use.
- Updated dependencies [[`dc3c8f2`](https://github.com/HuttonHomeHub/WorkHub/commit/dc3c8f298196702fecfa02620df3674d445d4896), [`bcbffed`](https://github.com/HuttonHomeHub/WorkHub/commit/bcbffedec011a3468ed6897792dbf771dd796c73)]:
  - @repo/types@0.2.0
