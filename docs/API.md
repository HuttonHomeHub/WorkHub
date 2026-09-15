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
    "code": "NOT_FOUND",
    "message": "Item not found.",
    "details": null,
  },
}
```

- `code` is a stable, machine-readable `SCREAMING_SNAKE_CASE` string.
- `message` is human-readable and safe to surface; never leak internals or
  stack traces.
- Validation failures return `422` with field-level `details`.

### Status codes

| Code | Use                                     |
| ---- | --------------------------------------- |
| 200  | Successful read/update                  |
| 201  | Resource created (body is the resource) |
| 204  | Success, no body (e.g. delete)          |
| 400  | Malformed request                       |
| 401  | Not authenticated                       |
| 403  | Authenticated but not authorised        |
| 404  | Resource not found                      |
| 409  | Conflict (e.g. duplicate)               |
| 422  | Validation failed                       |
| 429  | Rate limited                            |
| 500  | Unexpected server error                 |

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
  Auth's own surface, mounted outside the Nest router): email/password sign-up
  (`POST /api/auth/sign-up/email` — refused unless `AUTH_SIGNUP_ENABLED=true`,
  ADR-0018), sign-in (`POST /api/auth/sign-in/email`), session
  (`GET /api/auth/get-session`), and sign-out (`POST /api/auth/sign-out`).
- `GET /api/v1/me` returns the authenticated user's profile in the standard
  envelope.
- `GET /api/v1/config` (public) returns non-sensitive client settings the
  signed-out screens need, e.g. `{ "data": { "signUpEnabled": false } }`.
- State-changing requests require CSRF protection (Better Auth validates the
  Origin header against the trusted origins).
- `/api/auth/*` is mounted outside the Nest router, so Better Auth's own limiter
  rate-limits it (stricter on sign-in/sign-up) — see
  [`SECURITY_STANDARDS.md` → Rate limiting](SECURITY_STANDARDS.md#rate-limiting--abuse-protection).
- Protected routes are guarded server-side; `401` as per the table above.
  A resource owned by another user yields **404**, not 403 — see
  [`SECURITY_STANDARDS.md` → Authorisation](SECURITY_STANDARDS.md#authorisation--ownership-adr-0016).

## OpenAPI contract (ADR-0017)

- The spec is generated from decorators (`@nestjs/swagger`); Swagger UI is served
  at `/api/docs` in non-production environments.
- Document success responses with `ApiDataResponse(Dto)` /
  `ApiPaginatedResponse(Dto)` (`apps/api/src/common/openapi/api-responses.ts`) so
  the spec includes the envelope — never a bare `@ApiOkResponse({ type })`.
- The contract is committed as `apps/api/openapi.json`. `pnpm contract:generate`
  regenerates it and the client types in `@repo/types` that the web's
  `apiClient` is typed by; CI fails if either is out of date. Treat the
  contract diff as part of the review.
- Every endpoint documents its request/response schemas, status codes, and auth
  requirement.

## Conventions checklist (per endpoint)

- [ ] Correct verb, plural resource, versioned path
- [ ] DTO validation with explicit types
- [ ] Response uses the standard envelope; errors use `ApiError`
- [ ] Authenticated (or explicitly public); ownership enforced in the service
- [ ] Pagination for lists; indexes for filter/sort columns
- [ ] Envelope-aware OpenAPI decorators; contract regenerated (`pnpm contract:generate`)
- [ ] Tests: unit (service) + e2e (Supertest)
