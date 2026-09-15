# API conventions

> The conventions every endpoint must follow. Demonstrated by the reference
> template ([`docs/REFERENCE_FEATURE.md`](REFERENCE_FEATURE.md),
> `apps/api/examples/reference-feature/`) and wired globally per
> [`BACKEND_ARCHITECTURE.md`](BACKEND_ARCHITECTURE.md). Keep this in step with
> the OpenAPI document (`@nestjs/swagger`, served at `/api/docs` outside prod).
> Request models are `class-validator` DTOs; response models are explicit DTOs
> that never expose internal/audit columns.

## Style

- **REST over HTTPS**, JSON request/response bodies (`application/json`).
- Resource-oriented, plural nouns: `/items`, `/documents`.
- Use HTTP verbs correctly: `GET` (read, safe), `POST` (create), `PATCH`
  (partial update), `PUT` (full replace), `DELETE` (remove).
- All routes are served under the `/api` prefix and a version segment (below).

## Versioning

- URI versioning: `/api/v1/...`. A new **major** version is introduced only for
  breaking changes; additive changes stay within the current version.
- The OpenAPI document is the contract. Breaking changes require an ADR and a
  migration note in `CHANGELOG.md`.

## Response envelope

Successful responses wrap the payload (see `@repo/types`):

```jsonc
// 200 OK
{
  "data": {/* resource or array */},
  "meta": {/* optional: pagination, etc. */},
}
```

## Errors

A single, predictable error shape (`ApiError` in `@repo/types`):

```jsonc
// 4xx / 5xx
{
  "error": {
    "code": "BILL_NOT_FOUND",
    "message": "No item exists with that id.",
    "details": null,
  },
}
```

- `code` is a stable, machine-readable `SCREAMING_SNAKE_CASE` string.
- `message` is human-readable and safe to surface; never leak internals or
  stack traces.
- Validation failures return `422` with field-level `details`.

### Status codes

| Code | Use                                   |
| ---- | ------------------------------------- |
| 200  | Successful read/update                |
| 201  | Resource created (include `Location`) |
| 204  | Success, no body (e.g. delete)        |
| 400  | Malformed request                     |
| 401  | Not authenticated                     |
| 403  | Authenticated but not authorised      |
| 404  | Resource not found                    |
| 409  | Conflict (e.g. duplicate)             |
| 422  | Validation failed                     |
| 429  | Rate limited                          |
| 500  | Unexpected server error               |

## Pagination, filtering, sorting

- **Cursor-based** pagination for lists: `?limit=20&cursor=<opaque>`; responses
  include `meta.nextCursor` and `meta.hasMore`.
- Filtering via explicit query params; sorting via `?sort=field&order=asc|desc`.
- Always cap `limit` server-side to a sane maximum.

## Validation & data types

- Requests validated with `class-validator` DTOs; unknown properties rejected.
- If the app represents money, use **minor units (integer)** with an explicit
  currency code — never floating point. Timestamps are **ISO 8601 UTC** strings.

## Authentication

- Cookie-based sessions via Better Auth (secure, http-only, same-site).
- **Auth endpoints live at `/api/auth/*`** (unversioned — they are Better
  Auth's own surface, mounted outside the Nest router): open email/password
  signup (`POST /api/auth/sign-up/email`), sign-in
  (`POST /api/auth/sign-in/email`), session (`GET /api/auth/get-session`),
  and sign-out (`POST /api/auth/sign-out`).
- `GET /api/v1/me` returns the authenticated user's profile in the standard
  envelope.
- State-changing requests require CSRF protection (Better Auth validates the
  Origin header against the trusted origins).
- Protected routes are guarded server-side; `401` as per the table above.
  Note: a resource owned by another user yields **404**, not 403
  (anti-enumeration, ADR-0016).

## OpenAPI / docs

- The spec is generated from decorators (`@nestjs/swagger`) and served at
  `/api/docs` in non-production environments.
- Every endpoint documents its request/response schemas, status codes, and auth
  requirement. Treat the generated spec as part of the review.

## Conventions checklist (per endpoint)

- [ ] Correct verb, plural resource, versioned path
- [ ] DTO validation with explicit types
- [ ] Response uses the standard envelope; errors use `ApiError`
- [ ] Auth guard applied (or explicitly public)
- [ ] Pagination for lists; indexes for filter/sort columns
- [ ] OpenAPI annotations complete
- [ ] Tests: unit (service) + e2e (Supertest)
