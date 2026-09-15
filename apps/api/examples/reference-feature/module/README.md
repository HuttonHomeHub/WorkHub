# reference module (TEMPLATE)

The **canonical feature template** for the Blank App API. `ReferenceItem` is not a
business entity — it demonstrates every backend standard in one small,
fully-tested feature. Generate a real feature from it with
`pnpm gen:feature <entity>`; see
[`docs/REFERENCE_FEATURE.md`](../../../../../docs/REFERENCE_FEATURE.md).
(This README is not copied by the generator.)

## Layout

```text
module/
├── reference.module.ts        # DI wiring: controller → service → repository
├── reference.controller.ts    # HTTP surface (thin): DTOs, status codes, OpenAPI envelope
├── reference.service.ts       # Business logic: ownership authz, locking, logging
├── reference.repository.ts    # Data access: soft-delete filter, optimistic lock
├── reference.service.spec.ts  # Unit tests (repository mocked)
└── dto/
    ├── create-reference-item.dto.ts       # note: NO owner field — owner = caller
    ├── update-reference-item.dto.ts       # includes `version` (optimistic lock)
    ├── list-reference-items-query.dto.ts  # pagination + filter + sort
    └── reference-item-response.dto.ts     # safe representation (no internal columns)
```

The e2e test lives alongside this module at
[`../reference.e2e-spec.ts`](../reference.e2e-spec.ts); the generator places it
in `apps/api/test/`. See the [parent README](../README.md).

## Endpoints (`/api/v1/reference-items`)

| Method | Path   | Notes                                       |
| ------ | ------ | ------------------------------------------- |
| POST   | `/`    | 201; created item is owned by the caller    |
| GET    | `/`    | Cursor-paginated list of the caller's items |
| GET    | `/:id` | 404 if missing, soft-deleted, or not yours  |
| PATCH  | `/:id` | Optimistic lock (409 on stale version)      |
| DELETE | `/:id` | 204; soft delete                            |

All routes require an authenticated session (deny by default). Ownership is
checked in the service on the loaded row (ADR-0016): another user's item yields
the **same 404** as a missing one, so ids cannot be probed.
