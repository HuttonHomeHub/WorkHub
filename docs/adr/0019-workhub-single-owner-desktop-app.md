# ADR-0019: WorkHub is a single-owner, desktop web app

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** Project owner (drafted with Claude)

## Context

This repository began as "Blank App", a generic, domain-neutral starter
(DECISIONS.md, 2026-07-09). Its standards were written for the widest likely
target: a mobile-first, multi-tenant SaaS built and reviewed by a team, scaled
horizontally, and promoted through several environments. Supporting
infrastructure (BullMQ + Redis, a Redis cache, S3 object storage, OpenTelemetry)
was accepted in ADRs 0009–0011 and 0013 before any feature needed it.

The repository is now **WorkHub**, one real app with a known shape. ADR-0018
already recorded that it has a single user. An audit of the standards found that
many rules no longer fit, and some are wrong for this app:

- mobile-first layouts, touch targets, and LCP targets for a phone on 4G;
- internationalisation on the roadmap, and code kept locale- and
  currency-neutral;
- stateless horizontal scaling, shared Redis, and promotion through
  environments;
- a team delivery process (Product Owner, Solution Architect, Technical Lead)
  for every change, and a "≥ 80% coverage on changed code" claim that CI does
  not enforce;
- an append-only audit log and `created_by`/`updated_by` columns, which answer
  "which user did this?" in an app with one user.

`CLAUDE.md` (401 lines, loaded into every Claude Code session) restated these
rules from about eight other documents, so every session started from the wrong
assumptions.

## Decision

We will treat WorkHub as a **single-owner, desktop web app** and tailor the
repository's standards to it. The product profile lives in
[`docs/PRODUCT.md`](../PRODUCT.md); in summary:

- **Product:** WorkHub, one product. Purpose and domain are to be decided.
- **Users:** one owner; public sign-up closed, accounts via the server CLI
  (ADR-0018). No teams, roles or sharing.
- **Platform:** desktop browsers only — Chromium and Firefox, both in CI; Safari
  unsupported; no phone, tablet or touch design. Designed for ≥ 1280px windows;
  narrower windows must not break.
- **Input:** keyboard and mouse. The only custom shortcut is a command palette on
  Ctrl/Cmd+K.
- **UI:** compact density (14px body, 32px controls and rows); a collapsible
  sidebar rail and list/detail split panes where features need them; undo toasts
  by default, confirmation dialogs only for irreversible actions; light, dark and
  system themes.
- **Accessibility:** WCAG 2.2 AA stays a merge requirement, including 1.4.10
  reflow at 400% zoom.
- **Locale:** en-GB, GBP stored as integer pence, Europe/London — set in one
  place; no internationalisation or multi-currency.
- **Hosting:** self-hosted Docker Compose, a single API instance, internet-facing
  behind the owner's reverse proxy (TLS at the proxy). Before the first public
  deployment WorkHub needs passkeys as a second factor (recovery via the CLI), an
  explicit session policy, a brute-force posture and strong secrets.
- **Backups (planned):** nightly `pg_dump` on the host, an encrypted off-site copy
  (for example restic to S3-compatible storage or B2), retention of 7 daily /
  4 weekly / 6 monthly, a heartbeat alert for a missed backup, and a documented
  restore drill.
- **Images and releases:** images for amd64 and arm64; Changesets kept, with
  changesets only for changes to the running app, and a release cut when the
  owner wants to deploy.
- **Deferred infrastructure — new defaults when a feature first needs them:**
  - background jobs: **pg-boss or an in-process scheduler**, not BullMQ + Redis
    (defers ADR-0009);
  - caching: **no shared cache**; in-process memoisation only where measured
    (defers ADR-0010);
  - files: **a mounted, backed-up Docker volume** behind a storage service, not
    S3 object storage (defers ADR-0011);
  - observability: keep Pino and correlation IDs; **defer OpenTelemetry** (partly
    defers ADR-0013).
- **Data model:** no audit log and no `created_by`/`updated_by` columns. Soft
  deletes, timestamps and optimistic locking stay.
- **Process:** one developer working with Claude Code. Changes fall into four
  classes — **Trivial** (just do it), **Small** (state a 3–5 bullet plan, then
  proceed), **Feature** (written plan, owner approves) and **Architectural** (ADR,
  owner approves). A migration, auth or ownership code, a new runtime dependency
  or service, an OpenAPI breaking change, or a change to a CI or security gate
  raises a change by at least one class. The owner merges; Claude merges only
  when told in-session, with CI green, and never the release PR unless asked.

## Alternatives considered

- **Keep the repository a generic starter** — preserves reuse for hypothetical
  future apps, but every standard keeps describing an app nobody is building,
  and every session and review pays for it. Rejected; a future app can fork a
  tagged commit.
- **Leave the standards and override them case by case** — no rewrite effort,
  but contradictions pile up and nobody can tell which rule applies. Rejected.
- **Supersede ADRs 0009–0011 and 0013 outright** — cleaner on paper, but none of
  them is implemented and their reasoning (idempotent jobs, cache-aside
  discipline, storage behind an interface) still applies. Deferring with new
  defaults keeps that reasoning without committing to the infrastructure.
- **Keep audit-log and actor columns for future multi-user use** — pays a cost
  on every table for a non-goal. Rejected; ADR-0016 already names the migration
  path if the user model changes.

## Consequences

- **Standards that change** (rewritten in follow-up PRs; until then
  `docs/PRODUCT.md` wins where they conflict):
  - mobile-first, touch-target and phone-on-4G rules become desktop-first rules
    for ≥ 1280px windows;
  - "avoid hard-coding locale/currency, i18n is on the roadmap" becomes a single
    configured locale, currency and timezone;
  - stateless scale-out and shared Redis give way to a single-instance design;
  - the team process and Definition of Done give way to the four change classes;
  - the audit log and `created_by`/`updated_by` columns are removed from the
    database and security standards and from the reference template.
- **ADR-0009, 0010 and 0011** stay Accepted but are **deferred**: the defaults
  above apply until a feature needs the infrastructure, and adopting BullMQ,
  Redis or S3 would need a new ADR.
- **ADR-0013** is **partly deferred**: Pino logging, correlation IDs and health
  endpoints stand; OpenTelemetry metrics and traces wait until there is a need.
- **ADR-0016** stays in force, re-framed as cheap insurance for a single owner
  rather than a multi-user tenancy model.
- **ADR-0003** stands. Passkeys will be added through Better Auth's passkey
  plugin, which fits its plugin model without a new provider.
- `CLAUDE.md` becomes a short operating manual that links to the canonical
  documents instead of restating them.
- **Follow-up PRs:**
  1. safety fixes (image publishing, CI, containers) — in progress in parallel;
  2. this foundation: `PRODUCT.md`, this ADR, the `CLAUDE.md` rewrite;
  3. process and agents: `PROCESS.md`, templates, the agent set, Claude Code
     skills, and merging `ROADMAP.md`/`BACKLOG.md` into Now/Next/Later;
  4. frontend and UX standards;
  5. backend standards, including dropping the audit log and actor columns;
  6. operations documentation (backups, releases, hardening);
  7. the implementation backlog: backups, passkeys, the app shell, and more.

## References

- [`docs/PRODUCT.md`](../PRODUCT.md)
- [ADR-0003](0003-authentication-with-better-auth.md),
  [ADR-0009](0009-background-processing-bullmq.md),
  [ADR-0010](0010-caching-with-redis.md),
  [ADR-0011](0011-object-storage-abstraction.md),
  [ADR-0013](0013-observability-otel-pino.md),
  [ADR-0016](0016-owner-based-access-individual-accounts.md),
  [ADR-0018](0018-closed-signup-cli-account-management.md)
- [`docs/DECISIONS.md`](../DECISIONS.md) — 2026-07-09 and 2026-09-15 entries
