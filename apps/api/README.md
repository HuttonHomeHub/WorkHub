# @repo/api

The WorkHub REST API: **NestJS 11 + TypeScript**, **Prisma** ORM over **PostgreSQL**,
authentication via **Better Auth**, and an **OpenAPI** contract generated with
`@nestjs/swagger`.

> **Status:** walking skeleton. The cross-cutting infrastructure is live (config,
> logging, rate limiting, validation, envelopes, health, OpenAPI) and Better Auth
> is wired end-to-end: email/password auth at `/api/auth/*` (public sign-up
> off by default; accounts via `pnpm user:create`, ADR-0018), session
> validation in the deny-by-default guard, and the protected `GET /api/v1/me`.
> The schema holds only the authentication tables — **no domain features exist
> yet**. Build features with `pnpm gen:feature <entity> --tool <tool>` from the non-shipping
> [reference template](examples/reference-feature/) — see
> [`docs/REFERENCE_FEATURE.md`](../../docs/REFERENCE_FEATURE.md).

## Structure

```text
src/
  main.ts               # Nest bootstrap (logging, shutdown hooks, Swagger UI outside prod)
  app.setup.ts          # HTTP wiring shared with tests: Helmet, Better Auth handler, CORS, versioning
  app.module.ts         # Root module: logging, rate limit, validation, envelope, error filter, auth guard
  generate-openapi.ts   # Writes openapi.json without a server or database (ADR-0017)
  common/               # Cross-cutting: auth, guards, filters, interceptors, decorators, errors, openapi
  config/               # Typed, Zod-validated configuration
  prisma/               # PrismaService + module
  health/               # Liveness/readiness probes (@nestjs/terminus)
  me/                   # GET /api/v1/me — the authenticated user
  modules/              # Feature modules (created by `pnpm gen:feature`)
prisma/
  schema.prisma         # Auth models (Better Auth) + domain models
  migrations/           # Committed SQL migrations
openapi.json            # The committed API contract (`pnpm contract:generate`)
test/                   # Supertest end-to-end specs (*.e2e-spec.ts)
examples/
  reference-feature/    # Non-shipping TEMPLATE used by the generator (not compiled or shipped)
```

## Scripts

| Command               | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| `pnpm dev`            | Start Nest in watch mode                                         |
| `pnpm build`          | Compile to `dist/`                                               |
| `pnpm test`           | Run unit tests (Vitest)                                          |
| `pnpm test:e2e`       | Run HTTP end-to-end tests (Supertest; needs `DATABASE_URL`)      |
| `pnpm openapi`        | Regenerate `openapi.json` (prefer root `pnpm contract:generate`) |
| `pnpm prisma:migrate` | Create/apply a dev migration                                     |
| `pnpm prisma:deploy`  | Apply migrations (production/CI)                                 |
| `pnpm prisma:studio`  | Open Prisma Studio                                               |

The API loads `@repo/types` at runtime, so build it first when running scripts
directly (`pnpm --filter "@repo/api^..." build`); Turborepo tasks and `setup.sh` do
this for you.

## Environment

Copy the root [`.env.example`](../../.env.example) to `.env` and provide a
`DATABASE_URL`. Never commit real secrets.
