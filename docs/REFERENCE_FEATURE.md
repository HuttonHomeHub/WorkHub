# Implementation Standard — the reference feature

> **This is the canonical implementation standard for backend features**
> (ADR-0015). New features are generated from the reference template with
> `pnpm gen:feature <entity>` unless a documented architectural reason (an ADR)
> says otherwise. The template demonstrates every engineering standard in one
> small feature, with **no business logic**.
>
> The template lives at
> [`apps/api/examples/reference-feature/`](../apps/api/examples/reference-feature/)
> and is not shipped (ADR-0014). On every push CI generates a sample feature
> from it and type-checks, lints, unit-tests, and API-tests the result
> ([`scripts/verify-template.sh`](../scripts/verify-template.sh)), so neither
> the template nor the generator can silently rot.

This document is the **map**: it says where each standard is demonstrated and
links to the one document that defines it. It deliberately does not restate the
rules — if a rule and this page ever disagree, the linked standard wins.

## When to use it

- **Every new backend feature** (a resource with endpoints and/or persistence)
  starts with `pnpm gen:feature`.
- Use it for the **shape** — layers, naming, envelopes, authorisation, tests —
  not the content. `name`, `description`, and `status` are placeholders; replace
  them with your entity's fields.
- For **frontend features**, see [Frontend feature pattern](#frontend-feature-pattern).
- Not for one-off scripts, infrastructure, or pure refactors.

## Creating a new feature

1. **Run the delivery process first** ([`PROCESS.md`](PROCESS.md)): an approved
   feature doc in [`docs/features/`](features/README.md).
2. **Generate it:** `pnpm gen:feature <entity>` — singular, kebab-case
   (e.g. `time-entry`; pass `--plural` if the naive plural is wrong). It writes,
   with every rename done consistently:
   - `apps/api/src/modules/<plural>/` — module, controller, service,
     repository, DTOs, unit tests
   - `apps/api/test/<plural>.e2e-spec.ts` — API e2e tests
   - the model (with an `owner` → `User` relation) and the `User` back-relation
     in `apps/api/prisma/schema.prisma`
   - the module registration in `apps/api/src/app.module.ts`
3. **Replace the placeholder fields** with your entity's fields in the model,
   DTOs, service rules, and tests. Design the schema with the
   **database-architect** agent ([`DATABASE.md`](DATABASE.md)).
4. **Create the migration:** `pnpm --filter @repo/api prisma:migrate --name add_<plural>`
   and read the generated SQL.
5. **Regenerate the API contract:** `pnpm contract:generate` and commit
   `apps/api/openapi.json` + `packages/types/src/openapi.gen.ts` (ADR-0017).
6. **Make the tests green**, update [`API.md`](API.md) if conventions changed,
   and add a changeset.
7. **Review** with `/review`, which runs the backend-reviewer,
   security-reviewer, database-architect and test-engineer agents on these
   paths.

## Backend feature anatomy

```text
apps/api/src/modules/<feature>/
├── <feature>.module.ts          # DI wiring (controller, service, repository)
├── <feature>.controller.ts      # HTTP surface (thin)
├── <feature>.service.ts         # Business logic / use cases / authorisation
├── <feature>.repository.ts      # Data access (the only Prisma consumer)
├── <feature>.service.spec.ts    # Unit tests (repository mocked)
└── dto/
    ├── create-<entity>.dto.ts        # Request DTO — no owner field
    ├── update-<entity>.dto.ts        # includes `version` (optimistic lock)
    ├── list-<entities>-query.dto.ts  # pagination + filter + sort
    └── <entity>-response.dto.ts      # safe response shape (no internal columns)
apps/api/test/<feature>.e2e-spec.ts   # API e2e (Supertest + real Postgres)
```

### Layer responsibilities

- **Controller** — routing, versioned path, DTO binding, status codes, OpenAPI
  (`ApiDataResponse` / `ApiPaginatedResponse`), mapping entities to response
  DTOs. Injects the principal with `@CurrentUser()`. **No business logic.**
- **Service** — authorise → apply rules → delegate persistence → log. Owns
  transactions; throws typed domain errors (never HTTP exceptions); no raw
  Prisma.
- **Repository** — the only Prisma consumer. Centralises the soft-delete filter
  and the optimistic-locked update; swapping the ORM would touch only this file.

### Standard → canonical rule → where it is demonstrated

| Standard                                          | Canonical rule                                                                                               | In the template                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Modules, layering, DI                             | [ADR-0008](adr/0008-backend-modular-monolith.md), [`BACKEND_ARCHITECTURE.md`](BACKEND_ARCHITECTURE.md)       | `reference.module.ts`                                |
| REST conventions, status codes, envelopes         | [`API.md`](API.md)                                                                                           | `reference.controller.ts`, live interceptor/filter   |
| OpenAPI contract + generated client types         | [ADR-0017](adr/0017-shared-contracts-and-generated-api-client.md), [`API.md`](API.md)                        | `reference.controller.ts`                            |
| Validation (DTOs), pagination, filtering, sorting | [`API.md`](API.md)                                                                                           | `dto/*.dto.ts`, `ReferenceService.list`              |
| Owner-based access (anti-IDOR)                    | [`SECURITY_STANDARDS.md` → Authorisation](SECURITY_STANDARDS.md#authorisation--ownership-adr-0016)           | `ReferenceService.findOwnedOrThrow`                  |
| Errors (domain errors → envelope)                 | [`BACKEND_ARCHITECTURE.md` → Error handling](BACKEND_ARCHITECTURE.md#error-handling)                         | `ReferenceService`, `common/errors/`                 |
| Schema, soft delete, auditing, optimistic locking | [`DATABASE.md`](DATABASE.md)                                                                                 | `schema.reference.prisma`, `reference.repository.ts` |
| Structured, correlated logging                    | [`OBSERVABILITY.md`](OBSERVABILITY.md)                                                                       | `ReferenceService` (`PinoLogger`)                    |
| Typed configuration (no `process.env`)            | [`BACKEND_ARCHITECTURE.md` → Configuration](BACKEND_ARCHITECTURE.md#configuration)                           | `AppConfigService` (live)                            |
| Unit + API e2e tests                              | [`TESTING.md`](TESTING.md)                                                                                   | `reference.service.spec.ts`, `reference.e2e-spec.ts` |
| Security checklist                                | [`SECURITY_STANDARDS.md` → checklist](SECURITY_STANDARDS.md#secure-by-default-checklist-per-endpointfeature) | —                                                    |
| Performance checklist                             | [`PERFORMANCE.md` → Definition of done](PERFORMANCE.md#definition-of-done-performance)                       | —                                                    |

## What to customise vs. what must stay consistent

**Customise (per feature):** the entity, fields, model + migration, DTOs and
validation rules, business rules in the service, the specific queries in the
repository, and the endpoints.

**Keep consistent (never diverge without an ADR):**

- The **layering** controller → service → repository and the dependency rule.
- **Deny-by-default** authentication + **ownership** checks (ADR-0016).
- The standard **`{ data, meta }` / `{ error }` envelopes**, documented in
  OpenAPI with the envelope decorators, and status codes.
- **Validated DTOs**; safe response DTOs (no internal columns).
- **Soft delete, auditing, optimistic locking**, UUID v7, `timestamptz`,
  owner-scoped indexes.
- **Structured, correlated logging**; typed config; no `process.env`.
- **Tests** (unit + API e2e) and the coverage bar.

## Common mistakes to avoid

- Putting business logic in the controller, or Prisma queries in the service.
- Forgetting the **ownership** check after loading a row (⇒ IDOR), or taking the
  owner from the request body.
- Returning the raw entity (leaking `deletedAt`/`createdBy`) instead of a
  response DTO.
- Skipping the soft-delete filter, or bypassing the repository from the service.
- Using floats for money; using `ParseUUIDPipe` (rejects UUID v7) instead of
  `ParseUuidPipe` from `common/validation/uuid`.
- Swallowing errors, or leaking internal messages/stack traces to clients.
- Reading `process.env` directly; logging secrets/PII.
- Adding an endpoint without envelope-aware OpenAPI decorators, a regenerated
  contract, tests, or a doc update.

## Frontend feature pattern

There is no generated frontend template yet (see [`BACKLOG.md`](BACKLOG.md)); the
live `auth` and `account` features in `apps/web/src/features/` are the worked
examples. The authoritative rules are in
[`FRONTEND_ARCHITECTURE.md`](FRONTEND_ARCHITECTURE.md),
[`COMPONENT_LIBRARY.md`](COMPONENT_LIBRARY.md),
[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), and
[`FRONTEND_QUALITY.md`](FRONTEND_QUALITY.md).

```text
apps/web/src/features/<feature>/
├── api/          # Query/mutation hooks + a query-key factory, calling `apiClient`
├── schemas/      # Zod schemas (limits shared with the API from @repo/types)
├── components/   # Feature-scoped components (compose design-system primitives)
├── hooks/        # Feature-scoped hooks
└── index.ts      # The feature's public surface
```

Data flows through TanStack Query hooks that call the typed `apiClient`
(`apps/web/src/lib/api/client.ts`, ADR-0017) — components never `fetch`. Every
view designs loading, empty, error, and success states; WCAG 2.2 AA is a merge
requirement.

## Keeping the template healthy

`scripts/verify-template.sh` generates a throwaway `sample-widget` feature
through `pnpm gen:feature`, then type-checks, lints, and unit-tests it; with
`--e2e` it also pushes the schema to `DATABASE_URL` and runs the generated API
e2e test. CI runs both modes. It backs up and restores every file it touches.

When you change a cross-cutting standard (an envelope, a guard, the auth model),
**update the template in the same PR** and run the script. If you add a token
the generator does not rename, generation fails and names the file — extend the
replacement table in `scripts/gen-feature.mjs`.

## Delete-when-done

Once real features make it redundant, the template can be retired: delete
`apps/api/examples/reference-feature/`, `scripts/gen-feature.mjs`,
`scripts/verify-template.sh`, and the CI steps — or repoint the generator at a
real exemplar feature — and record the change in an ADR superseding ADR-0015.
