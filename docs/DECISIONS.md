# Decision log

A lightweight, chronological log of decisions that shape the project but don't
warrant a full [ADR](adr/). Significant, hard-to-reverse architectural choices
get an ADR instead (and may be linked from here).

> Format: newest first. Each entry records **what** was decided, **why**, and
> any **consequences**. Decisions are not edited once recorded — add a new entry
> to change course.

---

### 2026-09-24 — The app shell refresh: Inter, a slate and indigo palette, 32px density

**Decision.** WorkHub's look is a calm, polished pro tool, as the owner chose on
2026-09-23 ([app shell refresh](features/app-shell-refresh.md)): Inter
self-hosted from `@fontsource-variable/inter`; slate neutrals with one indigo
accent and soft status chips; 32px controls, 8px radius, hairline card shadows;
motion tokens; a three-way Theme menu; `Table`, `ProgressBar` and `EmptyState`
primitives. The sidebar is 224px and the week view's aside 16rem at 1280px.
The week view's warnings moved to a row under each day. The summary labels
periods that are not over instead of computing a target to date.

**Why.** The owner asked for the app to "look amazing" and for every visual
issue to be fixed. The font was named in the stack but never loaded. At 1280px
the week table and its aside did not fit side by side: the sidebar's 16px, the
aside's 2rem and the warnings column were what made them fit. A client-side
target to date would repeat the engine's day rules and be wrong whenever a
future day holds leave or a bank holiday.

**Consequences.** A new runtime dependency (fonts only: 48 kB of latin woff2 on
first visit, no JavaScript). Every colour pair is measured in both themes by
`tokens-contrast.test.ts`. A target-to-date figure, if wanted, belongs in
`time-summaries`.

### 2026-09-23 — Pin the dev container to Debian bookworm

**Decision.** The dev container image is
`mcr.microsoft.com/devcontainers/typescript-node:24-bookworm`, not the floating
`24` tag.

**Why.** The `24` tag moved to Debian trixie. The Docker-in-Docker feature's
default Moby engine has no trixie packages, so the image failed to build and
Codespaces opened a bare Alpine recovery container with no Node, pnpm or Docker.
Pinning the distribution makes the build reproducible.

**Consequences.** Moving to trixie is a deliberate change: switch the tag and
set the feature's `"moby": false` (Docker CE), then confirm a fresh Codespace
runs `scripts/setup.sh` cleanly.

The bookworm image already ships pnpm on the `PATH`, so `postCreateCommand`
runs `scripts/setup.sh` directly. A leading `corepack enable` fails with
`EACCES` writing `/usr/local/bin` and stopped setup from running at all.
`setup.sh` loads the root `.env` before calling the Prisma CLI, which otherwise
reads only `apps/api/.env`. The `github-cli` feature provides `gh` for `/ship`
and `/review`.

---

### 2026-09-16 — Operations documentation defaults

**Decision.** The operations documentation is written for one owner running one
Compose stack (ADR-0019), with these defaults for choices the owner delegated:

- **Documents:** [OPERATIONS.md](OPERATIONS.md) (the self-hosting runbook) and
  [RELEASING.md](RELEASING.md) (versioning, the Version Packages PR, image tags)
  replace `DEPLOYMENT.md`, which mixed both with a multi-environment rollout
  model that WorkHub does not have.
- **Reverse proxy examples:** **Caddy** is the primary example (automatic TLS,
  forwarded headers by default), with a **Traefik** labels snippet as the
  secondary. Any proxy works if it forwards `X-Forwarded-For` and
  `X-Forwarded-Proto` and its address is in `AUTH_TRUSTED_PROXIES`.
- **GHCR package visibility:** recommend making `workhub/api` and `workhub/web`
  **public**, since the repository is public; `docker login ghcr.io` with a
  `read:packages` token is documented as the alternative. The owner decides
  (BACKLOG.md).
- **Exposure:** WorkHub is **not exposed to the internet** until passkeys, the
  session policy, the per-account brute-force posture, auth security events and
  automated backups exist; until then it is reached over a LAN or VPN only.
- **Database password:** generated with `openssl rand -hex 32`, because compose
  places it inside `DATABASE_URL` and a `/` from base64 breaks the URL.
- **Changeset bumps** follow what the owner must do on the server: `patch` for
  fixes, `minor` for features or any migration, `major` when the upgrade needs
  more than the routine runbook.
- **Release notes** are the per-package changelogs Changesets writes
  (`apps/api/CHANGELOG.md`, `apps/web/CHANGELOG.md`); the root `CHANGELOG.md` is
  pre-release history. Every `CHANGELOG.md` counts as a historical record for
  `pnpm docs:check`, so release notes can quote superseded wording.

**Why.** `DEPLOYMENT.md` described staged environments, gradual rollouts and a
platform secret store, and left the owner without a first-deploy, backup,
restore or secret-rotation procedure. Checking the docs against the real
compose, workflow and CLI files also found a database-password recipe that could
break `DATABASE_URL`, and release notes that would have failed the docs check on
`main` after the first release.

**Consequences.** ARCHITECTURE.md shows the real topology and trust boundaries,
DEVELOPMENT.md holds the Codespace specifics, and the devops-reviewer checks
against OPERATIONS.md and RELEASING.md. Configuration gaps found on the way
(nginx asset headers, container hardening, health-ordered start-up, Dependabot
for the Postgres image, workflow timeouts, public source maps, a scripted
pre-migration dump, the network subnet, image visibility, a production compose
smoke test) are BACKLOG.md items. `pnpm docs:check` rejects the removed terms.

### 2026-09-16 — Backend standards defaults

**Decision.** The backend standards are tailored to one owner and one API
instance (ADR-0019), with these defaults for choices the owner delegated:

- **Validation:** API DTOs stay on `class-validator`; environment, CLI and web
  use Zod; rules both apps enforce live in `@repo/types`. Revisit at the NestJS
  12 migration (TECH_DEBT.md), where Standard Schema could unify them.
- **Pagination:** cursor-based stays, with an optional `meta.total` for desktop
  tables and a maximum `limit` of 200 (100 today; the code change is in
  BACKLOG.md). The list search parameter is `q`.
- **Status codes:** 400 for a request that cannot be interpreted (malformed JSON,
  path id or cursor), 422 for a well-formed request that breaks a rule — as the
  code already behaves.
- **Soft delete:** user-facing domain entities soft-delete; purging is a manual
  "empty trash", never automatic; uniqueness uses partial unique indexes on
  active rows.
- **Transactions:** the service opens `prisma.$transaction` and passes the
  transaction client to repository methods that take an optional client.
- **Migrations:** forward-only with a backup before every deploy, and a
  data-preserving plan plus a dry run on a restored copy for destructive or
  data-transforming changes. Expand/contract is dropped.
- **Coverage:** no percentage anywhere; coverage is a local diagnostic, not a
  gate. Adding a CI coverage gate would be a separate, escalated change.
- **API versioning:** keep `/api/v1`; web and API deploy in lockstep on one
  `IMAGE_TAG`, so there is no major-version process — the OpenAPI contract diff
  is the review.
- **Test layers:** API e2e against a real `_test` Postgres database is the
  primary backend layer; unit tests only for real logic; no mocked-repository
  tests for pass-through CRUD.
- **Auth security events** go to the structured logs instead of an audit log.

**Why.** The previous standards described a multi-tenant SaaS: an audit log and
actor columns, expand/contract for zero-downtime rollouts, queues, caches and
object storage drawn as live, load and SLO targets, and an unenforced 80%
coverage rule. They also left real gaps — transactions, time handling, error
details, cursor validation, session policy, test database isolation.

**Consequences.** [API.md](API.md), [DATABASE.md](DATABASE.md),
[SECURITY_STANDARDS.md](SECURITY_STANDARDS.md), [TESTING.md](TESTING.md),
[OBSERVABILITY.md](OBSERVABILITY.md), [PERFORMANCE.md](PERFORMANCE.md),
[BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) and
[REFERENCE_FEATURE.md](REFERENCE_FEATURE.md) are rewritten, `SECURITY.md` becomes
a short disclosure policy, and the reference template drops `created_by` and
`updated_by`. Gaps found while checking the code against the docs are
BACKLOG.md items. `pnpm docs:check` rejects the removed terms outside historical
records.

### 2026-09-15 — Right-size the process and agents for a solo developer

**Decision.** Replace the team delivery process with the four change classes,
now detailed in [PROCESS.md](PROCESS.md): Trivial and Small changes ship with CI,
tests and path-matched reviews; Features get one living feature doc in
`docs/features/` approved by the owner and built in slices; Architectural changes
get an ADR. The two team-shaped templates, the project brief and the worked
example are replaced by one feature template. The separate roadmap document is
replaced by Now / Next / Later in [PRODUCT.md](PRODUCT.md), and the backlog
becomes a one-line list. The PR template is rewritten for Claude-filled bodies;
CODEOWNERS, the issue templates, CONTRIBUTING and the code of conduct are removed
(backlog lives in the repository; there are no other contributors). The agents go
from 12 to 8 — planner, ui-reviewer, accessibility-reviewer, backend-reviewer,
security-reviewer, database-architect, test-engineer, devops-reviewer — with one
reviewer output contract, and Claude Code skills (`/ship`, `/review`,
`/feature`, `/deps`, `/release`, `/adr`) encode the recurring workflows.

**Why.** One developer works with Claude Code and there are no human reviewers.
The old process required a five-stage spec and plan for every requirement,
approving reviews nobody could give, and an unenforced Definition of Done; the
overlapping agents disagreed on output and still assumed a team-built SaaS
(ADR-0019).

**Consequences.** `pnpm docs:check` rejects the removed agent names and process
terms outside historical records, and checks agent and skill frontmatter. A
`.claude/settings.json` (permissions and a format hook) is proposed separately
for the owner's line-by-line review. Commitlint accepts Dependabot's `deps-dev`
scope.

---

### 2026-09-15 — Tailor the repository to WorkHub

**Decision.** Stop treating this repository as a domain-neutral base. It is
**WorkHub**: one product for a single owner, used in desktop browsers, self-hosted
and internet-facing. This reverses the 2026-07-09 "Generalise the repository
into a domain-neutral base" entry and the "keep the repository a domain-neutral
base" part of the tidy-up entry below. The product profile is in
[PRODUCT.md](PRODUCT.md); the decision, its new defaults, and the deferral of
ADRs 0009–0011 and part of 0013 are in
[ADR-0019](adr/0019-workhub-single-owner-desktop-app.md).

**Why.** The generic standards assumed a mobile-first, multi-tenant SaaS built by
a team, which WorkHub is not. `CLAUDE.md` restated those rules in every Claude
Code session, so work started from wrong assumptions.

**Consequences.** `CLAUDE.md` is rewritten as a short manual that links to the
canonical documents, and it defines four change classes in place of the team
process. Standards documents that still assume the old shape carry a "pending
rewrite" banner until their area PR lands; where they conflict with PRODUCT.md,
PRODUCT.md wins. The workspace package names (`blank-app`, `@repo/*`) are
unchanged.

---

### 2026-09-15 — Dependency pass: release tags follow Changesets; NestJS 12 deferred

**Decision.** Take the open Dependabot updates as a few grouped PRs
instead of one at a time. Move to Changesets 3 and `changesets/action` v2, with
`privatePackages` enabled and `@repo/api`, `@repo/web`, `@repo/types` in one
`fixed` version group. Publish images from the tags Changesets actually creates
(`@repo/api@X.Y.Z`, `@repo/web@X.Y.Z`) and tag images `X.Y.Z` / `X.Y` / `sha`
with no `v`. Take Better Auth 1.7. Defer NestJS 12 (tracked in
[TECH_DEBT.md](TECH_DEBT.md)).

**Why.** Changesets 3 stops versioning private packages by default, which
would have silently ended releases. Also, the image workflow triggered on `v*.*.*`
tags, which Changesets never creates, so no image would ever have been
published after a release. `@nestjs/throttler` does not support NestJS 12 yet.

**Consequences.** One release version names both images (`IMAGE_TAG=X.Y.Z`).
Removing `fixed` or `privatePackages` breaks image publishing. The account CLI
passes Better Auth's `email-password` provisioning source to `createUser`.
`pnpm docs:check` rejects `vX.Y.Z` wording.

---

### 2026-09-15 — Tidy the base: Node 24, generator, shared contracts, single-source docs

**Decision.** Keep the repository a domain-neutral base but point its
placeholders at `HuttonHomeHub/WorkHub`. Move to **Node 24 LTS** (Node 22 is in
maintenance) and add a **dev container**. Rate-limit `/api/auth/*` per client via
Better Auth with `AUTH_TRUSTED_PROXIES`. Fix the api image, which pnpm 10's
`deploy` had broken. Adopt **shared contracts and a generated API client**
(ADR-0017). Replace copy-and-adapt with a **feature generator**
(`pnpm gen:feature`), which CI verifies including its API e2e test — the
alternative ADR-0015 deferred. Make each rule **single-source** in the docs,
guarded by `pnpm docs:check`. The earlier "defer hosting-platform choice" entry
is resolved: the reference deployment is self-hosted Compose (2026-07-12).

**Why.** An onboarding review found docs that contradicted ADR-0016 in a dozen
places, an auth rate limit that shared one bucket across all clients in
production, an api image that could not be built, and the only cross-boundary
validation rule duplicated by hand.

**Consequences.** `@repo/types` has a build step; API changes need
`pnpm contract:generate`; the template must keep its names in the generator's
rename table. Superseded terms get added to `scripts/check-docs.mjs`.

---

### 2026-07-12 — Individual accounts, walking skeleton, and self-hosted deployment

**Decision.** Shape the base for **multiple individual user accounts** — open
email/password signup, no organisations, roles, or admin (ADR-0016 supersedes
ADR-0012's organisation RBAC). Land the **walking skeleton**: Better Auth wired
end-to-end (schema, `/api/auth/*` handler, session validation, `/api/v1/me`),
and a web app entry (TanStack Router/Query, RHF + Zod, shadcn/ui primitives,
theme management) with sign-up/sign-in/sign-out and a protected shell. Make the
web image **environment-portable** (nginx proxies `/api/*`; no baked
`VITE_API_URL`) and add `docker-compose.prod.yml` — pinned GHCR images behind
the operator's own reverse proxy, Postgres unexposed, secrets required, and a
one-shot `prisma migrate deploy` service.

**Why.** The apps this template will produce are self-hosted, Docker-run,
multi-user-but-flat products; organisation RBAC was permanent accidental
complexity for that shape, and an unproven pipeline (web never built in CI)
was the biggest foundation risk.

**Consequences.** CI now builds both apps and runs the Playwright auth journey
(with axe WCAG checks) against real Postgres. Teams/roles/sharing would require
superseding ADR-0016. Email flows (verification, password reset) need an SMTP
integration before they can be enabled.

---

### 2026-07-09 — Generalise the repository into a domain-neutral base ("Blank App")

**Decision.** Repurpose this repository from the Bills product into **Blank App**,
a reusable, domain-neutral starter to base future applications on. Renamed the
workspace (`bills` → `blank-app`) and the package scope (`@bills/*` → `@repo/*`),
generalised the resource-scoping model from "household" to "organisation", and
replaced product-specific docs (README, ROADMAP, BACKLOG, worked example) and
guidance with neutral equivalents. Domain assumptions (e.g. money-as-minor-units)
are now framed as **conditional** guidance rather than baked-in rules.

**Why.** The same production-grade foundation — tooling, CI/CD, containers,
architecture, standards, delivery process, agents, and the canonical feature
template — is valuable across many applications, not just one product. A clean
base avoids re-inventing it per project and keeps the quality bar consistent.

**Consequences.** No application/domain code exists; the schema has no models.
Starting a real app means replacing the product-facing docs and building the
first feature from the reference template (`docs/REFERENCE_FEATURE.md`). The
`@repo/*` scope is a convention teams may rename per fork.

---

### 2026-07-09 — Establish a formal delivery process for features

**Decision.** Introduce [`docs/PROCESS.md`](PROCESS.md): every new requirement
goes through business understanding → functional requirements → technical
analysis → solution design → implementation planning, is approved, and only then
implemented. Added feature-spec / implementation-plan templates, a worked
example, a Definition of Ready/Done (Feature Completion Criteria), and a
`feature-analyst` agent; wired the criteria into the PR template and CLAUDE.md.

**Why.** Prevent idea→code shortcuts; ensure every feature is understood,
designed, reviewed, and shipped to the same bar; make the method repeatable and
discoverable for humans and AI assistants.

**Consequences.** Slightly more up-front work per feature, repaid in fewer
reworks and clearer history. The process itself is versioned and evolves via
normal doc updates (and an ADR if it changes architecturally).

---

### 2026-07-08 — Adopt the requested stack for the foundation

**Decision.** Build the repository foundation around Turborepo + pnpm, React +
Vite (Tailwind v4 / shadcn/ui / Lucide), NestJS, PostgreSQL + Prisma, REST +
OpenAPI, Better Auth, Vitest/Supertest/Playwright, Docker + GHCR, GitHub
Actions, and SemVer via Conventional Commits + Changesets.

**Why.** A cohesive, TypeScript-end-to-end stack with strong typing, mature
tooling, and good local/CI ergonomics; matches the product's needs and the
team's direction.

**Consequences.** Established the monorepo layout, shared config/types packages,
and all tooling. Recorded the weightier choices as ADR-0002 (monorepo) and
ADR-0003 (auth).

---

### 2026-07-08 — Money stored as integer minor units

**Decision.** Represent monetary amounts as integers in minor units (e.g.
pence) with an explicit currency code; never floating point.

**Why.** Avoids binary floating-point rounding errors in sensitive data.

**Consequences.** DTOs, Prisma models, and UI formatting must follow this;
documented in [API.md](API.md) and [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

---

### 2026-07-08 — Defer hosting-platform choice

**Decision.** Keep deployment platform-neutral for now (container-first) and
decide the concrete host later.

**Why.** Insufficient information at the foundation stage; premature lock-in is
costly.

**Consequences.** Tracked in [TECH_DEBT.md](TECH_DEBT.md) and the
[roadmap](PRODUCT.md#roadmap); `docker-publish` targets GHCR so any container platform
can consume the images.
