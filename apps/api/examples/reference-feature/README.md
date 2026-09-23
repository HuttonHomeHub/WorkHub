# Reference feature — the canonical template

> **This is the canonical implementation standard for new features.** It is the
> input to the feature generator (`pnpm gen:feature <entity> --tool <tool>`), not part of the
> running application: it is excluded from the build, the app module, linting,
> and database migrations (**ADR-0014**), and it **is CI-verified** so it can't
> rot (**ADR-0015**). Full guidance:
> [`docs/REFERENCE_FEATURE.md`](../../../../docs/REFERENCE_FEATURE.md).

## Status

- **Not shipped.** Nothing here runs in the API; the live schema contains only
  the authentication tables until you generate a feature.
- **CI-verified.** `scripts/verify-template.sh` generates throwaway features (one
  in a tool, one in core) from this template with `scripts/gen-feature.mjs`, then **type-checks, lints, and
  unit-tests it** — and, with `--e2e`, runs its API e2e test against Postgres.
  Run it locally with `bash scripts/verify-template.sh [--e2e]`.

## Layout

```text
reference-feature/
├── module/
│   ├── reference.module.ts         # DI wiring: controller → service → repository
│   ├── reference.controller.ts     # HTTP surface (thin)
│   ├── reference.service.ts        # Business logic / use cases
│   ├── reference.repository.ts     # Data access — the only Prisma consumer
│   ├── reference.service.spec.ts   # Unit tests for the service's rules
│   └── dto/                        # Request + response DTOs
├── reference.e2e-spec.ts           # API e2e (Supertest + real Postgres)
└── schema.reference.prisma         # Model sketch the generator appends to schema.prisma
```

## Editing the template

Keep every entity-specific name in the forms the generator renames
(`ReferenceItem`, `ReferenceItems`, `referenceItem`, `reference-item(s)`,
`reference_items`, `reference item(s)`, `Reference<Layer>`). Any other
"reference" wording makes generation fail with the offending file, which is
deliberate — see the replacement table in `scripts/gen-feature.mjs`.

## What it demonstrates

Layered controller → service → **repository**; validated DTOs; standard
`{ data, meta }` / `{ error }` envelopes documented in OpenAPI; cursor
pagination + filtering + sorting; **owner-scoped** authorisation (anti-IDOR,
ADR-0016) with a real `owner` foreign key; soft delete with restore (undo);
transaction-ready repository methods; timestamps; optimistic locking; structured logging with correlation IDs; and API (Supertest) + unit
tests. The standard-by-standard map is in
[`docs/REFERENCE_FEATURE.md`](../../../../docs/REFERENCE_FEATURE.md).
