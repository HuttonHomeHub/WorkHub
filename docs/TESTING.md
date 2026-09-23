# Testing

> The canonical home of WorkHub's test strategy: which layer tests what, how the
> test database is isolated, how to run each suite, and exactly what CI runs.
> The browser and viewport matrix is in [FRONTEND_QUALITY.md](FRONTEND_QUALITY.md#test-matrix);
> accessibility checks are in [ACCESSIBILITY.md](ACCESSIBILITY.md).

Tests prove behaviour. **Every feature ships tests; every bug fix ships a
regression test that fails without the fix** (CLAUDE.md §4). There is no
coverage percentage to hit. Rules marked **(planned)** are the standard for new
code but not yet in place; each has a [BACKLOG.md](BACKLOG.md) item.

## Layers

WorkHub is a thin CRUD API over PostgreSQL for one owner, so most backend bugs
live where the HTTP layer, validation, ownership and SQL meet. The tests are
weighted to match:

| Layer                         | Tool                                             | Tests                                                                                                                            | Location                                                                |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **API e2e — primary backend** | Vitest + Supertest, real Nest app, real Postgres | Every endpoint's status codes and envelopes, validation (400/422), ownership 404s, optimistic-lock 409s, pagination, auth wiring | `apps/api/test/**/*.e2e-spec.ts`                                        |
| **Unit**                      | Vitest                                           | Real logic only: calculations, state machines, date and time rules, pure helpers, config validation                              | `apps/*/src/**/*.{spec,test}.ts(x)`, `packages/domain/src/**/*.test.ts` |
| **Component**                 | Vitest + Testing Library (jsdom)                 | Form behaviour and component states, queried by role and label                                                                   | `apps/web/src/**/*.test.tsx`                                            |
| **Browser journeys**          | Playwright + axe                                 | The critical user flows end to end, with an accessibility scan on every screen                                                   | `apps/web/e2e/**`                                                       |

- **Do not write mocked-repository service tests for pass-through CRUD.** A test
  that mocks Prisma and asserts the mock was called proves nothing the e2e test
  does not prove better. Unit-test a service only for logic with real branches.
  The template's `reference.service.spec.ts` covers the ownership, conflict and
  cursor branches; delete what a generated feature does not need.
- **Behaviour, not implementation.** Assert on HTTP responses, rendered roles and
  text, and database state — not on private calls.
- One behaviour per test, Arrange–Act–Assert, a name that states the rule.

## API e2e tests

Each suite boots the real `AppModule` with `configureApp` — the same global
pipe, filter, interceptor, guards, Better Auth handler and body parsing as
production — and talks to it through Supertest.

- **Authentication.** Feature suites override `AuthContextService` with a test
  principal (`overrideProvider`), as the template does; production stays deny by
  default. The real session flow is covered once, in `auth.e2e-spec.ts` and
  `accounts.e2e-spec.ts`.
- **Prerequisites** (as CI does):

  ```bash
  pnpm --filter @repo/types build
  export DATABASE_URL='postgresql://app:app@localhost:5432/app_test?schema=public'
  pnpm --filter @repo/api prisma:deploy
  pnpm --filter @repo/api test:e2e
  ```

- **Lazy imports.** Suites import `AppModule` inside `beforeAll`, because
  configuration is validated on import.

### Test database isolation

- **API e2e runs only against a database whose name ends in `_test`**
  (`app_test` locally and in CI) — never the development `app` database. Suites
  create and delete rows, and `scripts/verify-template.sh --e2e` pushes a
  throwaway schema with `--accept-data-loss`; the script refuses any other
  database name outside CI.
- **Each suite creates its own users and rows and removes them afterwards**
  (deleting a test user cascades to its data). Use fixed, suite-specific ids or
  emails so re-runs are idempotent.
- **Known gap:** the template's `beforeEach` calls `deleteMany()` on the whole
  table. That is harmless in a dedicated `_test` database, but new suites should
  scope cleanup to their own test users **(planned for the template)**.
- Files run in separate workers but share one database; never assert on a
  table-wide count.

### Shared helpers (planned)

`createTestApp()` (boot and configure the app with optional provider overrides)
and `signInAs(user)` (a real session cookie via the CLI account helpers) in
`apps/api/test/helpers/`, replacing the boot and cookie code each suite repeats
today.

### Skips

Suites use `describe.skipIf(!process.env.DATABASE_URL)`, so `pnpm test:e2e`
passes on a machine without a database. **(planned)** In CI a missing
`DATABASE_URL` must fail the job rather than skip every suite.

## Determinism

- **No real network or third-party services.** Everything runs against the
  local app and database.
- **Time (planned):** code that reads "now" will take an injected `Clock`
  ([DATABASE.md](DATABASE.md#time)); tests pass a fixed clock, and Vitest's fake
  timers cover timers. Until then, assert on relative order or shape, not exact
  timestamps, and never on the wall-clock date.
- **Randomness:** generate ids in the test or assert on shape.
- No `.only` (Playwright's `forbidOnly` fails CI) and no committed `.skip`
  except the database guard.

## Frontend tests

- Component tests use Testing Library with jsdom (`apps/web/src/test/setup.ts`),
  querying by accessible role and name.
- Playwright journeys start the API and web dev servers (`playwright.config.ts`),
  create their account in `e2e/global-setup.ts`, and call
  `expectNoA11yViolations(page)` (`e2e/support.ts`) on every screen. A journey
  that tests layout sets its viewport with `test.use({ viewport })`, as
  `e2e/app-shell.spec.ts` does for 1280×800, 1920×1080 and the 320 CSS px
  reflow floor.
- Which browsers, viewports, keyboard-only and 400%-zoom journeys are required is
  in [FRONTEND_QUALITY.md](FRONTEND_QUALITY.md#test-matrix).

## Running tests

```bash
pnpm test                               # all unit and component tests (Turborepo)
pnpm test:e2e                           # API e2e + Playwright (needs DATABASE_URL, migrations, browsers)
pnpm --filter @repo/api test            # API unit tests
pnpm --filter @repo/domain test         # the hours engine and time helpers
pnpm --filter @repo/api test:e2e        # API e2e only
pnpm --filter @repo/web test:watch      # web tests in watch mode
pnpm --filter @repo/web test:e2e        # Playwright only
bash scripts/verify-template.sh         # generate a feature from the template; typecheck, lint, unit-test it
DATABASE_URL='postgresql://app:app@localhost:5432/app_test?schema=public' \
  bash scripts/verify-template.sh --e2e # …and run its API e2e (a *_test database is required)
```

**Coverage** is a local diagnostic, not a gate:
`pnpm --filter @repo/api exec vitest run --coverage` uses the v8 settings in
`apps/api/vitest.config.ts` (`@vitest/coverage-v8` is not a dependency, so Vitest
offers to install it). Use it to find untested branches, not to chase a number.
CI neither collects nor enforces coverage; adding a coverage gate would be a
change to a CI gate, and so an escalation ([PROCESS.md](PROCESS.md)).

## CI

[`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs three jobs on every
pull request and push to `main`; all must pass.

| Job                                                | Steps                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **quality** — Format, lint, typecheck & unit tests | Install; Prisma client; `pnpm format:check`; `pnpm docs:check`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm build`; `pnpm contract:generate` then `git diff --exit-code` on the contract and generated types (ADR-0017)                                                                              |
| **template** — Verify feature template             | `bash scripts/verify-template.sh`                                                                                                                                                                                                                                                                          |
| **e2e** — End-to-end tests                         | A `postgres:17-alpine` service with database `app_test`; Prisma client; `prisma:deploy`; install **Chromium only**; `pnpm test:e2e` (API e2e and Playwright on the `chromium` project; journeys that set no viewport run at the default Desktop Chrome size); then `bash scripts/verify-template.sh --e2e` |

CI runs no Firefox project, and only the app shell journey sets the 1280×800 /
1920×1080 viewports —
standing debt in [TECH_DEBT.md](TECH_DEBT.md), scheduled in PRODUCT.md's Next
list. CodeQL runs in its own workflow ([SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#dependencies)).

## Checklist

- [ ] Each new or changed endpoint has API e2e tests for its status codes, including the ownership 404
- [ ] Unit tests only where there is logic; none that only assert mocks
- [ ] A bug fix has a test that failed before the fix (show the red run in the PR)
- [ ] New user-facing flows have a Playwright journey with axe
- [ ] E2E ran against a `_test` database; suites clean up their own data
- [ ] No `.only`, no new skips, no dependence on the real clock
