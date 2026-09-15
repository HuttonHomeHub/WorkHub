# Roadmap

> **Pending rewrite (ADR-0019).** Parts of this document assume a generic base repository rather than WorkHub — where it conflicts with [PRODUCT.md](PRODUCT.md), PRODUCT.md wins.

> This roadmap still records the foundation's milestones. WorkHub's product
> roadmap (Now / Next / Later) replaces it once the process PR lands; the
> product decisions are in [PRODUCT.md](PRODUCT.md).

## Purpose

Provide a clean, opinionated, production-grade starting point so a new
application can begin delivering features immediately, to a consistent quality
bar, without re-inventing tooling, architecture, or process.

## Milestones (the base)

### ✅ M0 — Foundation (current)

Engineering foundation complete: Turborepo + pnpm monorepo, strict TypeScript,
lint/format, CI/CD (quality + template-verify + e2e + CodeQL + release + image
publishing), Docker, docs, ADRs, a delivery process, specialised agents, and a
**CI-verified canonical feature template**. The API boots (config, health,
OpenAPI, Prisma, logging, guards). **No business features; the schema has no
models.**

### ✅ M1 — Web walking skeleton (done)

Vite app entry, providers, TanStack Router/Query, RHF + Zod, app shell + base
shadcn/ui primitives per `docs/FRONTEND_ARCHITECTURE.md`; authentication wired
end-to-end (Better Auth: sign-up, sessions, owner-based access — ADR-0016);
same-origin /api proxying; production compose with a migration step; CI runs
the full `pnpm build` and the Playwright auth journey (with axe a11y checks).

### ✅ M2 — Base tidy-up (done)

Node 24 LTS and a dev container; per-client rate limiting of the auth routes;
a buildable api image; shared contracts with a generated, typed API client
(ADR-0017); `pnpm gen:feature` with CI verification including API e2e; docs made
single-source and guarded by `pnpm docs:check`.

### ✅ M3 — Closed sign-up (done)

Public sign-up off by default; accounts created and passwords reset from the
server (`pnpm user:*`), a seeded development account, no email required
(ADR-0018).

### 🔜 When you start an application

- Build the first real feature with `pnpm gen:feature`
  (`docs/REFERENCE_FEATURE.md`) — it adds the first domain model + migration.
- Wire observability (OpenTelemetry), and add Redis / object storage only when a
  job, hot cache path, or file-upload feature needs them (ADR-0009/0010/0011).

## Guiding constraints

- Keep `main` releasable; ship thin vertical slices.
- Maintain the quality bar (tests, a11y, security, docs) on every change.
- Follow the delivery process (`docs/PROCESS.md`) for new features.
