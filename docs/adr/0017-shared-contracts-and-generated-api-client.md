# ADR-0017: Shared contracts and a generated API client

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** Project owner (repository tidy-up review)

## Context

ADR-0007 said form schemas and API payload shapes would be shared through
`@repo/types` "so the client and server agree on shape and constraints". In
practice nothing was shared: `@repo/types` held three hand-written interfaces,
and the one real cross-boundary rule — the 8-character password minimum — was
written in the web's Zod schema with a comment asking people to keep it in step
with Better Auth's default.

The API's OpenAPI document was also inaccurate. Controllers documented bare
DTOs (`@ApiOkResponse({ type })`), but the global `TransformInterceptor` wraps
every response in `{ data, meta? }`. `docs/API.md` calls the spec "the
contract", and `docs/FRONTEND_ARCHITECTURE.md` planned a client generated from
it — which would have produced wrong types.

Constraints: the API compiles to CommonJS and runs on Node; the web is bundled
by Vite; `@repo/types` previously shipped raw `.ts` and had no build, so the API
could only import types from it, never values.

## Decision

1. **`@repo/types` is the contract package** for everything both sides must
   agree on: envelope types, generated API types, and small runtime constants
   (e.g. `PASSWORD_MIN_LENGTH`). It gains a build (`tsc` → `dist/`, ESM).
   The web (Vite dev server, build, and its Vitest tests) resolves the
   TypeScript source through a `source` export condition, so it needs no prior
   build. Node — the API runtime, the API's tests, and the Docker image — loads
   `dist/`, which Turborepo's `^build` dependency builds first for `dev`,
   `build`, `lint`, `typecheck`, and tests (and `setup.sh` builds on setup).
   Type-checking everywhere reads the source via the `types` field.
2. **The OpenAPI spec describes the real envelope.** Controllers use
   `ApiDataResponse(Dto)` / `ApiPaginatedResponse(Dto)`
   (`apps/api/src/common/openapi/api-responses.ts`) instead of bare response
   types.
3. **The spec is generated, committed, and drift-checked.**
   `pnpm contract:generate` writes `apps/api/openapi.json` (booting the module
   graph without a database) and generates `packages/types/src/openapi.gen.ts`
   with [openapi-typescript](https://openapi-ts.dev). CI regenerates both and
   fails if the working tree changes. Contract changes therefore appear as a
   reviewable diff in every PR that alters the API.
4. **The web calls the API through a typed client.** `apiClient`
   (`apps/web/src/lib/api/client.ts`) is an
   [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) client typed by the
   generated `paths`; a middleware turns non-2xx responses into `ApiRequestError`
   carrying the standard error envelope. The untyped `apiFetch` helper is removed
   so there is one way to call the API.
5. **Shared validation rules are constants, enforced on both sides.** The web
   Zod schemas and the API's Better Auth configuration (password length, display
   name length) read the same constants from `@repo/types`.

## Alternatives considered

- **Share Zod schemas across the boundary** — would require replacing
  `class-validator` DTOs in the API (e.g. `nestjs-zod`), contradicting ADR-0008's
  validation approach and the reference template. Constants give the no-drift
  benefit for the rules that actually cross the boundary, at far lower cost.
  Revisit if many feature forms mirror API payloads one-to-one.
- **tRPC / ts-rest** — end-to-end types without codegen, but replaces the REST +
  OpenAPI contract that `docs/API.md` and the reviewer agents are built around.
  Rejected.
- **A full generated SDK (orval, openapi-generator)** — generates hooks and
  classes; large generated surface and a second data-fetching layer beside
  TanStack Query (ADR-0004). Rejected in favour of types + a ~6 kB fetch client.
- **Keep hand-written types and a comment to "keep in step"** — the status quo
  that already drifted. Rejected.
- **Consume `@repo/types` source from Node without a build** (type stripping) —
  Node refuses to strip types under `node_modules`, which is where
  `pnpm deploy` places the package in the Docker image. Rejected.

## Consequences

- **Positive:** one source for cross-boundary rules and shapes; an accurate,
  reviewable API contract; compile errors in the web when an endpoint changes
  shape; the documented "generated client" evolution is done before the first
  feature needs it.
- **Negative / trade-offs:** `@repo/types` has a build step (handled by Turbo,
  `setup.sh`, and the Dockerfile); contributors must run
  `pnpm contract:generate` after changing an endpoint (CI tells them if they
  forget); `openapi-fetch` is a new runtime dependency.
- **Follow-ups:** error responses are not yet described per endpoint in the
  spec (the envelope type lives in `@repo/types`); add them if client code needs
  status-specific error typing.

## References

- ADR-0007 (forms and validation), ADR-0008 (modular monolith), ADR-0004
  (server state), `docs/API.md`, `docs/FRONTEND_ARCHITECTURE.md`
