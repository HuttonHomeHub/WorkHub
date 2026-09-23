# API conventions

> The canonical home of WorkHub's HTTP conventions: paths, envelopes, status and
> error codes, lists, dates and money on the wire, payload limits, versioning and
> the OpenAPI contract. The reference template
> ([REFERENCE_FEATURE.md](REFERENCE_FEATURE.md)) demonstrates them; security
> rules are in [SECURITY_STANDARDS.md](SECURITY_STANDARDS.md) and the layering
> behind them in [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md).

Rules marked **(planned)** are the standard for new code but are not yet
implemented everywhere; each is tracked in [BACKLOG.md](BACKLOG.md) or PRODUCT.md's
[roadmap](PRODUCT.md#roadmap).

## Paths and verbs

- JSON over HTTPS (TLS ends at the owner's reverse proxy). Request and response
  bodies are `application/json`.
- Resources are plural nouns: `/api/v1/time-entries`, `/api/v1/time-entries/:id`.
  No verbs in paths; an action that is not CRUD is a sub-resource
  (`POST /api/v1/invoices/:id/send`).
- **Restore** undoes a soft delete: `POST /api/v1/<resource>/:id/restore` →
  **200** with the restored row and a new `version`. It is idempotent (an
  active row is returned unchanged); a missing or another owner's row is 404,
  and an active row holding the same unique key is 409.
- **Names are app-wide.** Resources are named for what they hold, never for the
  tool that owns them (`/api/v1/work-days`, not `/api/v1/hours/days`), so they
  must be specific (`time-adjustments`, not `adjustments`). A tool is visible
  through its OpenAPI tag (ADR-0020 §4).
- `GET` reads (safe, no side effects), `POST` creates, `PATCH` partially
  updates, `DELETE` removes (soft delete — [DATABASE.md](DATABASE.md#soft-delete)).
  `PUT` is not used.
- Ids in paths are UUIDs, validated with `ParseUuidPipe`
  (`apps/api/src/common/validation/uuid.ts`) — Nest's `ParseUUIDPipe` rejects
  UUID v7.
- Everything is under `/api` except the health probes, which stay at the root:
  `/health` and `/health/ready` ([OBSERVABILITY.md](OBSERVABILITY.md#health)).

## Versioning

- Every Nest route is URI-versioned: `/api/v1/...` (the default version is `1`).
- **There is no major-version process.** The web and API images are released
  together at one version and deployed on one `IMAGE_TAG`
  ([RELEASING.md](RELEASING.md#the-configuration-invariants)), so the only client is always in lockstep
  with the server. A breaking change updates the web client in the same PR.
- The **OpenAPI contract diff is the review** of every API change (below). A
  breaking change is an escalation trigger ([PROCESS.md](PROCESS.md)) and is
  called out in the PR.

## Response envelopes

Success (`ApiResponse<T>` in `@repo/types`), added by the global
`TransformInterceptor`:

```jsonc
// 200 OK / 201 Created
{ "data": { "id": "0192…", "name": "…" } }

// 200 OK, a list
{ "data": [/* … */], "meta": { "nextCursor": "0192…", "hasMore": true } }
```

A `204 No Content` has no body. Handlers return a DTO (wrapped as `data`) or a
`Paginated` result (`data` + `meta`); they never build the envelope themselves.

Error (`ApiError` in `@repo/types`), produced by the global
`AllExceptionsFilter` for every Nest route:

```jsonc
{ "error": { "code": "NOT_FOUND", "message": "Time entry not found." } }
```

- `code` is a stable `SCREAMING_SNAKE_CASE` string that clients branch on.
- `message` is safe to show; it never contains internals or stack traces.
- `details` is present only when there is something structured to report
  (validation failures, below).

### The `/api/auth/*` exception

Better Auth's handler is mounted before the Nest router
(`apps/api/src/app.setup.ts`), so `/api/auth/*` responses **do not use the
envelope and are not in the OpenAPI contract**. Its errors look like
`{ "message": "Invalid email or password", "code": "INVALID_EMAIL_OR_PASSWORD" }`
with Better Auth's own statuses (400, 401, 403, 429). The web talks to these
routes only through `authClient` (`apps/web/src/features/auth/api/auth-client.ts`), never
through `apiClient`. The routes WorkHub uses:

| Route                          | Purpose                                                   |
| ------------------------------ | --------------------------------------------------------- |
| `POST /api/auth/sign-in/email` | Email/password sign-in; sets the session cookie           |
| `POST /api/auth/sign-out`      | Ends the current session                                  |
| `GET /api/auth/get-session`    | The current session and user, or `null`                   |
| `POST /api/auth/sign-up/email` | Refused unless `AUTH_SIGNUP_ENABLED=true` (ADR-0018; off) |

The WorkHub endpoints around them are `GET /api/v1/me` (the signed-in user) and
the public `GET /api/v1/config` (`{ "signUpEnabled": false }` — non-sensitive
flags the signed-out screens need).

## Status codes

| Code | When                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------ |
| 200  | A read, an update, or an idempotent create that found the existing row                           |
| 201  | Created; the body is the new resource                                                            |
| 204  | Success with no body (delete)                                                                    |
| 400  | The request cannot be interpreted: malformed JSON, a malformed path id, a malformed cursor       |
| 401  | No valid session                                                                                 |
| 403  | Not used for ownership — reserved for an action the owner may never take (none exist today)      |
| 404  | Missing, soft-deleted, **or owned by someone else** — the same response for all three (ADR-0016) |
| 409  | Optimistic-lock version mismatch, unique violation, or an idempotent-create id clash             |
| 413  | Body over the size limit ([Payload limits](#payload-limits))                                     |
| 422  | A well-formed request that fails validation: body or query DTO rules, or a domain rule           |
| 429  | Rate limited (the Nest throttler, or Better Auth's limiter on `/api/auth/*`)                     |
| 500  | Anything unexpected; the body is always `INTERNAL_ERROR` with a generic message                  |

**400 vs 422, the rule:** if the request could not be parsed into the shape the
endpoint expects, it is **400**; if it parsed but a value breaks a rule, it is
**422**. That is how the code behaves today: `ParseUuidPipe` and `IsCursor()`
throw 400, the global `ValidationPipe` is configured with
`errorHttpStatusCode: 422`, and a domain `ValidationError` maps to 422.
Prisma's `P2023` (a value that cannot be converted to the column's type, such as
a malformed UUID) also maps to 400, as a backstop for a value that slips past
boundary validation. The trade-off: a server-side bug that passes a bad value
would also look like a 400, so the filter logs each one at `warn` with
`prismaCode` and `prismaModel` (not the value). A `P2023` in the logs means a
missing boundary check or a bug — investigate it.

## Error codes

**Today** the filter derives codes from the HTTP status or the domain error:

| Code                     | Status | Source                                                                                      |
| ------------------------ | ------ | ------------------------------------------------------------------------------------------- |
| `BAD_REQUEST`            | 400    | `ParseUuidPipe`, `IsCursor()`, malformed JSON, other `BadRequestException`s, Prisma `P2023` |
| `UNAUTHENTICATED`        | 401    | The authentication guard                                                                    |
| `FORBIDDEN`              | 403    | `ForbiddenError` (unused)                                                                   |
| `NOT_FOUND`              | 404    | `NotFoundError`, Prisma `P2025`, unknown routes                                             |
| `CONFLICT`               | 409    | `ConflictError` (including optimistic locking), Prisma `P2002`                              |
| `PAYLOAD_TOO_LARGE`      | 413    | A body over the parser's size limit                                                         |
| `UNSUPPORTED_MEDIA_TYPE` | 415    | A body in a charset or encoding the parser cannot read                                      |
| `VALIDATION_FAILED`      | 422    | The `ValidationPipe`, `ValidationError`                                                     |
| `RATE_LIMITED`           | 429    | The Nest throttler                                                                          |
| `INTERNAL_ERROR`         | 500    | Anything else, including unmapped Prisma errors                                             |
| `ERROR`                  | other  | Fallback for an `HttpException` status with no mapping                                      |

**(planned — PRODUCT.md, Later)** An error-code catalogue in `@repo/types`: one exported union of
codes, so the API throws and the web branches on the same constants. Feature
codes are added there when a client needs to tell two failures apart that share a
status (for example `VERSION_CONFLICT` vs `DUPLICATE_NAME`, both 409). Until
then, use the generic codes above — do not invent ad-hoc strings in a service.

## Validation errors

Every body and query is a `class-validator` DTO checked by the global
`ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`), so unknown
fields are rejected. Rules the web also enforces come from `@repo/types`
(ADR-0017).

- **Omitted, `null` and bounds.** An omitted optional field is left unchanged.
  `null` is accepted only where it means something (clearing a nullable field
  or cap); on any other field it is a 422. Use `IsOmittable()`
  (`common/validation/optional.ts`), not `@IsOptional()`, which lets `null`
  through to Prisma as a 500, and make update DTOs with
  `PartialType(Create…Dto, { skipNullProperties: false })`. A nested object is
  `@IsObject()` before `@ValidateNested()`, so an array is rejected. `version`
  is capped at the INT4 maximum, and names reject control characters.
- **A list cursor** must be one of the caller's own active rows; anything else
  returns an empty page, the same as a missing id (ADR-0016).

**Today** `details` is the array of `class-validator` messages:

```jsonc
// 422
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Validation failed.",
    "details": ["name must be longer than or equal to 1 characters"],
  },
}
```

**(planned)** Structured details the web form can attach to fields:

```jsonc
"details": [{ "field": "name", "code": "minLength", "message": "Enter a name." }]
```

`field` is the DTO property path (`lines.0.amountPence` for nested values),
`code` the rule that failed. Client code must not parse today's strings.

## Lists

Every collection endpoint is paginated, owner-scoped, and follows these
parameters:

| Parameter   | Meaning                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `limit`     | Page size. Default 20; maximum 100 today, **200 (planned)** for desktop tables                        |
| `cursor`    | Opaque token from the previous page's `meta.nextCursor`. Clients never build or parse it              |
| `sort`      | One field from the endpoint's allow-list (`@IsIn([...])`); default `createdAt`                        |
| `order`     | `asc` or `desc`; default `desc`                                                                       |
| `q`         | Free-text search, case-insensitive, on the fields the endpoint documents                              |
| `<field>`   | An exact-match filter named after the response field: `status=ACTIVE`                                 |
| `from`/`to` | A range on the endpoint's main date: `from` inclusive, `to` exclusive; `YYYY-MM-DD` or an ISO instant |

- **Response `meta`:** `{ nextCursor, hasMore }` (`PageMeta` in `@repo/types`).
  **(planned)** an optional `total` — the count for the same filters — on
  endpoints whose table shows a count; it is omitted, not `null`, elsewhere.
- **Stable order:** the query sorts by the chosen field and then by `id`, so
  pages never skip or repeat rows. Every sortable field needs an index with
  `owner_id` first ([DATABASE.md](DATABASE.md#queries-and-indexes)).
- **Cursor today** is the last row's `id`. `PaginationQueryDto` checks it with
  `IsCursor()` (`common/validation/cursor.ts`): anything that is not a UUID is
  answered with **400 `BAD_REQUEST`** before the query runs. Change that check
  if the cursor format changes.
- Filters and sort fields are explicit DTO properties — never pass a client
  object straight into a Prisma `where` or `orderBy`.

### Computed read-models

A summary or balance that is computed, not stored (ADR-0020 §4), is a `GET`
collection under its own plural noun (`/api/v1/time-summaries`):

- bounded by a validated date range (`from` inclusive, `to` exclusive, at most
  366 days; otherwise **422**) instead of a cursor;
- the normal `{ data }` envelope with no `meta`;
- never written — no `POST`, `PATCH` or `DELETE`.

## Idempotent create (planned)

A create may accept an optional client-generated `id` (UUID v7) so a retried
request cannot make a duplicate — useful for undo, double-submits and flaky
connections:

- No `id` → the server generates one (UUID v7 database default) and returns 201.
- A new `id` → created with that id, 201.
- An `id` that already exists for the caller's own row → **200** with the
  existing resource; the body is not re-applied.
- An `id` that exists but is not the caller's → **409 `CONFLICT`**, with no
  detail that confirms whose it is.

The template does not implement this yet (BACKLOG.md). Add it to endpoints the
web retries or replays, not to every create.

## Dates, money and other values

| Kind             | On the wire                                                     | Example                      |
| ---------------- | --------------------------------------------------------------- | ---------------------------- |
| Instant          | ISO-8601 in UTC with `Z` (`Date#toISOString()`)                 | `"2026-09-16T08:30:00.000Z"` |
| Calendar date    | `YYYY-MM-DD`, no time or zone                                   | `"2026-09-16"`               |
| Money            | Integer **pence**, field name ending `Pence`; no currency field | `"amountPence": 1250`        |
| Id               | UUID string (v7 from the server)                                | `"0192a3b4-…"`               |
| Enum             | `SCREAMING_SNAKE_CASE` string                                   | `"ACTIVE"`                   |
| Optional, absent | `null` in responses; omitted in requests                        | `"description": null`        |

The server never formats for display: the web renders instants in
`Europe/London` and pence as GBP for `en-GB`
([PRODUCT.md](PRODUCT.md#locale)). How these are stored is in
[DATABASE.md](DATABASE.md#data-types).

## Payload limits

- JSON and URL-encoded bodies are parsed by `express.json()` and
  `express.urlencoded()` with Express's default **100 kB** limit
  (`apps/api/src/app.setup.ts`). Raise it per route only with a reason.
- Every string DTO field has `@MaxLength`, and every array `@ArrayMaxSize`, so a
  body within the byte limit is still bounded.
- An oversized body is answered with **413 `PAYLOAD_TOO_LARGE`** in the error
  envelope, and a body in an unsupported charset or encoding with **415
  `UNSUPPORTED_MEDIA_TYPE`**. The parsers reject these before any route or the
  request logger runs, so the filter assigns the correlation id itself
  ([OBSERVABILITY.md](OBSERVABILITY.md#correlation-ids)).
- The filter recognises body-parser errors only by a known `type` (a list in
  `all-exceptions.filter.ts`) and answers each with a fixed message, never the
  parser's own, which can echo client input. An unlisted type is a 500.
- File uploads are not supported yet; the default when a feature needs them is a
  backed-up Docker volume (ADR-0019), designed in that feature's doc.

## OpenAPI contract (ADR-0017)

- The spec is generated from `@nestjs/swagger` decorators. Swagger UI is served
  at `/api/docs` **outside production only** (`apps/api/src/main.ts`).
- Document responses with `ApiDataResponse(Dto)` / `ApiPaginatedResponse(Dto)`
  (`apps/api/src/common/openapi/api-responses.ts`) so the spec includes the
  envelope — never a bare `@ApiOkResponse({ type })`. Every endpoint has an
  `@ApiOperation` summary.
- The contract is committed as `apps/api/openapi.json`. After any API change run
  `pnpm contract:generate`, which also regenerates
  `packages/types/src/openapi.gen.ts` for the web's typed `apiClient`, and
  commit both. CI regenerates them and fails on drift.
- Error envelopes are not yet described per endpoint ([TECH_DEBT.md](TECH_DEBT.md)).

## Endpoint checklist

- [ ] Plural resource under `/api/v1`; correct verb; `ParseUuidPipe` on ids
- [ ] Authenticated, or `@Public()` with a reason ([SECURITY_STANDARDS.md](SECURITY_STANDARDS.md#authentication))
- [ ] Ownership enforced in the service; another owner's row is the same 404
- [ ] Body and query DTOs bound every field; 400 vs 422 as above
- [ ] Response DTO exposes no internal columns; instants, dates and pence as above
- [ ] Lists: `limit`/`cursor`/`sort`/`order`, allow-listed sort, indexed, owner-scoped
      (computed read-models: a bounded date range instead)
- [ ] Soft-deleting resources have `POST /:id/restore`
- [ ] Errors use the generic codes (or catalogue codes once they exist)
- [ ] Envelope-aware OpenAPI decorators; `pnpm contract:generate` committed
- [ ] API e2e tests for each status code the endpoint returns ([TESTING.md](TESTING.md))
