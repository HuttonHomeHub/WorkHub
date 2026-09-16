# ADR-0020: Modular tools over shared core data

- **Status:** Proposed
- **Date:** 2026-09-16
- **Deciders:** Project owner (drafted with Claude)
- **Owner's answer:** approved as drafted on 2026-09-16; Status moves to Accepted at
  the final approval of the hours tracker plan

## Context

WorkHub now has a purpose. The owner works in construction management and Home
Office construction engineering, and wants WorkHub to be "a collection of tools
and apps that will help me do my job and manage it". The tools must be
**modular**, but **data can be shared across the tools**. The first tool is an
hours tracker ([feature doc](../features/hours-tracker.md)); later tools are
not yet named, but likely candidates (projects and sites, site visits, leave
planning, reports) would read the same records.

What exists today:

- ADR-0008: a NestJS modular monolith; feature modules talk only through their
  exported providers.
- ADR-0014/0015: every backend feature is generated from the reference template
  with `pnpm gen:feature <entity>`, which writes `apps/api/src/modules/<plural>/`,
  a Prisma model with an `owner` relation, and an e2e suite. Diverging from its
  cross-cutting patterns needs an ADR.
- ADR-0016/0019: one owner, `owner_id` on every domain row, one API instance and
  one PostgreSQL database.
- The web has `features/<feature>/` folders with a strict "no feature → feature
  imports" rule. There is no sidebar, command palette or navigation registry yet.

Nothing says what a "tool" is, where one tool's data ends and shared data
begins, or how a second tool reads the first tool's records. Settling this
before the first tool is built is cheap. Settling it after three tools means a
migration for every table in the wrong place.

The design is for one developer. It must not add runtime machinery, a deployment
per tool, or ceremony that the generator and the reviewers cannot check.

## Decision

We will build WorkHub as **one app made of tools**. A tool is a compile-time
grouping of ordinary features: an API module group, a web feature folder, a
sidebar entry, palette commands and routes. Records that more than one tool
needs live in a **shared core**. There is no plugin runtime and no per-tool
switch; every tool ships in the one image.

### 1. A tool, on both sides

Each tool has a stable **tool id**: a short, kebab-case noun (`hours`). The id
`core` is reserved.

| Part          | Location and convention                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| API modules   | `apps/api/src/modules/<tool>/<entity-plural>/`, one generated module per entity, grouped by a `<Tool>Module` (`modules/<tool>/<tool>.module.ts`) |
| Pure rules    | `packages/domain/src/<tool>/` (`@repo/domain`): calculation and validation logic with no framework imports, run by both apps (section 5)         |
| Prisma models | `schema.prisma`, under a `// === Tool: <tool> ===` banner; one model per entity, as the template generates it                                    |
| OpenAPI       | One tag per tool (`Hours`) on every controller in the tool                                                                                       |
| Web feature   | `apps/web/src/features/<tool>/` with `api/`, `components/`, `schemas/`, `hooks/` and `index.ts`, as FRONTEND_ARCHITECTURE.md already describes   |
| Tool manifest | `features/<tool>/tool.ts` exports `{ id, label, icon, path, commands }`; `apps/web/src/app/tools.ts` lists the manifests in sidebar order        |
| Routes        | `apps/web/src/routes/_authed/<tool>/…`, so a tool's pages live under `/<tool>`                                                                   |
| Sidebar       | One entry per tool, built from the manifest (Lucide icon, sentence-case label, `aria-current` on the tool's routes)                              |
| Palette       | Each manifest declares "Go to <tool>" plus the tool's primary actions; the palette reads every manifest when it is built                         |
| Settings      | A tool's own settings are its own data and page: `/<tool>/settings`, stored in that tool's tables                                                |

`app/` is the web's composition root, like `routes/`, so `app/tools.ts` may
import each feature's manifest. Shared layers still never import features.

### 2. Shared core versus tool-owned data

- **Tool-owned** is the default. An entity starts in the tool that creates it.
- **Core** holds records that are facts about the owner's work and are not
  specific to one tool's rules, **and** that a second tool needs. Today core is
  only `users`. The hours tracker adds the first core entity, public holidays (England and
  Wales, bundled),
  because calendar facts belong to no single tool.
- **Promote on second use.** When a second tool needs a tool-owned entity, move
  it to core in its own PR before the second tool uses it. Because names never
  carry a tool prefix (section 3), a promotion moves folders and imports only.
  It needs **no migration**.
- Core lives in `apps/api/src/modules/core/<entity-plural>/`,
  `apps/web/src/features/core/<entity>/` and `packages/domain/src/core/`.

### 3. How tools reference shared records

| From → to         | Database                                                       | API code                                              | Web code                                    |
| ----------------- | -------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| Tool → core       | Foreign key, `onDelete: Restrict` (or `SetNull` when optional) | Import the core module; call its **exported service** | Import from `features/core/<entity>`        |
| Core → tool       | Never                                                          | Never                                                 | Never                                       |
| Tool → other tool | Never; promote the entity to core first                        | Never                                                 | Never (the existing feature → feature rule) |
| Any → `users`     | `owner_id`, `onDelete: Cascade` (ADR-0016, unchanged)          | The principal                                         | The session                                 |

- **Ownership is unchanged.** Core rows carry `owner_id` like any domain row. A
  core service's exported read methods take the principal and apply the same
  ownership rule, so a tool can never read around it.
- `features/core` is the one exception to the no feature → feature rule: any
  tool may import it, and it imports no tool.

### 4. Naming, routes and URLs

- **Tables and API resources are named for what they hold, never for the tool:**
  `work_days` and `/api/v1/work-days`, not `hours_days` or
  `/api/v1/hours/days`. Names are unique across the app, so they must be
  specific (`time-adjustments`, not `adjustments`). This keeps API.md's flat,
  plural-noun rule and makes promotion to core a code move.
- **Web routes are grouped by tool:** `/<tool>` is the tool's home;
  `/<tool>/<page>` for its other pages; `/<tool>/settings` for its settings. Core
  entities that get their own pages use `/<entity-plural>` (for example
  `/projects`). Search params follow UX_STANDARDS.md → URL state.
- **Tool ids and route segments are stable**, because they are bookmarks. A
  rename keeps a redirect from the old path.
- **Computed read-models** (a summary or a balance, not stored rows) are `GET`
  collections under their own plural noun (`/api/v1/time-summaries`). They are
  bounded by a validated date range (at most 366 days, otherwise 422) instead of
  a cursor. They use the normal `{ data }` envelope, carry no `meta`, and are
  never written.

### 5. Shared pure logic: `@repo/domain`

Rules that both apps run — the hours calculation engine first — live in a new
workspace package, `packages/domain` (`@repo/domain`). The code is pure
TypeScript, with no Nest, React or Prisma imports, and is foldered by tool and
core. The API uses it for authoritative results; the web uses it for live
feedback while the owner types. `@repo/types` keeps contracts and shared limits
(ADR-0017). Date and time zone helpers for `Europe/London` live in
`packages/domain/src/core/time/`, built on the TC39 **Temporal** API through
`temporal-polyfill`. It is imported from one module, not patched onto
`globalThis`, so moving to native Temporal once Node ships it is a one-file
change.

### 6. The generator and the template (ADR-0014/0015)

- `pnpm gen:feature <entity> --tool <tool>` writes
  `modules/<tool>/<plural>/`, adds the entity module to the `<Tool>Module`
  (creating the group module and registering it in `AppModule` on first use),
  places the model under the tool's banner and sets the OpenAPI tag.
  `--core` does the same for `modules/core/`. Without either flag the
  generator refuses, so no feature lands outside a tool or core.
- The reference template itself does not change shape: layering, envelopes,
  ownership, soft delete, optimistic locking and tests stay exactly as
  REFERENCE_FEATURE.md describes. `scripts/verify-template.sh` exercises the
  `--tool` path.
- There is still no generated web side (BACKLOG.md). The hours tool's
  `features/hours/` becomes the worked example for a tool's web folder and
  manifest.

## Alternatives considered

- **Plain features, no tool concept.** No new rules. But the owner asked
  explicitly for modular tools. The sidebar and palette would need a registry
  anyway. And with no rule for shared records, the second tool would import the
  first tool's internals, or duplicate them. Rejected.
- **Namespace everything by tool** (`/api/v1/hours/work-days`, `hours_`
  table prefixes). Ownership is visible in every path. But it contradicts API.md's
  flat resources, and moving an entity to core would rename its table and break
  its API paths: a destructive migration plus a contract break. Rejected.
  OpenAPI tags and folder layout give the grouping without the cost.
- **A PostgreSQL schema per tool** (Prisma `multiSchema`). The database enforces
  the boundaries. But every migration, e2e reset and backup must handle several
  schemas, and cross-schema foreign keys to core blur the isolation it promises.
  That is too heavy for one developer at personal scale. Rejected; revisit only if
  convention-based boundaries fail in review.
- **Separate apps or deployments per tool** (one repository, image or database
  each, joined by APIs). Strong isolation and independent releases. But sharing
  data needs synchronisation or service calls, and one owner would run N stacks,
  N backups and N login hardenings. Rejected by ADR-0019's single-instance shape.
- **A runtime plugin system** (tools registered or enabled at runtime,
  lazy-loaded bundles, per-tool feature flags). Lets tools be switched off. But
  it is machinery with no user: one owner wants every tool, and route-level code
  splitting already keeps bundles small. Rejected.
- **Calculation logic only in the API** (instead of `@repo/domain`). No new
  package, and one runtime for the rules. But the web could show totals only
  after each save round-trip, and any client-side preview would be a second,
  untested copy of the rules. This is a reasonable fallback if the owner prefers
  it; the owner chose the shared package on 2026-09-16.

## Consequences

- **Easier:** adding a tool is mechanical (generator flag, manifest, routes).
  Shared data has one home and one ownership rule. Moving an entity to core
  needs no migration. The API contract stays flat and predictable.
- **Harder:** boundaries are by convention. Nothing in PostgreSQL stops a tool
  table from referencing another tool's table, so **database-architect** and
  **backend-reviewer** check the matrix in section 3. An ESLint import-boundary
  rule (tool ↛ tool, core ↛ tool) is a follow-up. App-wide unique names need a
  little more thought when choosing names.
- **New package:** `@repo/domain` adds a workspace package to build, lint and
  test in Turborepo. Its Temporal polyfill (`temporal-polyfill`) is a new runtime
  dependency and needs security-reviewer, per the escalation triggers. It adds
  roughly 20 kB gzipped to the chunks of the routes that use it.
- **Follow-up documentation (in the PRs that implement them):**
  - PRODUCT.md: purpose, glossary, feature inventory and roadmap;
  - BACKEND_ARCHITECTURE.md and REFERENCE_FEATURE.md: `modules/<tool>/` and
    `modules/core/`, and the generator flags;
  - FRONTEND_ARCHITECTURE.md: the tool manifest, `app/tools.ts`,
    `features/core` and the import-rule exception;
  - API.md: computed read-models bounded by a date range;
  - ARCHITECTURE.md: the tool/core picture.
- **Follow-up code:** the generator flags and verify-template coverage; the tool
  registry and sidebar (the app shell); `packages/domain`. Each is a slice in
  the hours tracker plan.
- ADR-0008, 0014, 0015, 0016 and 0017 stay in force; this ADR refines where
  modules live and how they relate, and supersedes none of them.

## References

- [`docs/features/hours-tracker.md`](../features/hours-tracker.md): the first
  tool
- [ADR-0008](0008-backend-modular-monolith.md),
  [ADR-0014](0014-reference-feature-as-non-shipping-template.md),
  [ADR-0015](0015-template-driven-feature-development.md),
  [ADR-0016](0016-owner-based-access-individual-accounts.md),
  [ADR-0017](0017-shared-contracts-and-generated-api-client.md),
  [ADR-0019](0019-workhub-single-owner-desktop-app.md)
- [`docs/API.md`](../API.md), [`docs/DATABASE.md`](../DATABASE.md),
  [`docs/FRONTEND_ARCHITECTURE.md`](../FRONTEND_ARCHITECTURE.md),
  [`docs/UX_STANDARDS.md`](../UX_STANDARDS.md)
