# CLAUDE.md — WorkHub operating manual

Instructions for Claude Code working in this repository. Keep this file short:
link to the canonical document instead of restating a rule.

## 1. WorkHub in brief

- A private, self-hosted web app for **one owner**, used in **desktop browsers**
  (Chromium, Firefox; designed for ≥ 1280px), internet-facing behind the owner's
  reverse proxy. Purpose and domain: **TBD**.
- Stack: Turborepo + pnpm, TypeScript strict on Node 24, React 19 + Vite +
  Tailwind v4 + shadcn/ui, NestJS 11, PostgreSQL 17 + Prisma, Better Auth.
- Locale is fixed: en-GB, GBP as integer pence, Europe/London.
- The profile and its reasoning: [`docs/PRODUCT.md`](docs/PRODUCT.md) and
  [ADR-0019](docs/adr/0019-workhub-single-owner-desktop-app.md).

## 2. Current state

- **Exists:** email/password sign-in and sessions (Better Auth), closed sign-up
  with CLI accounts (ADR-0018), a protected shell, `GET /api/v1/me`,
  `GET /api/v1/config`, health endpoints, the feature generator, CI, Changesets
  and GHCR images.
- **Does not exist:** domain features or models, passkeys, backups, the sidebar,
  command palette, background jobs, caching, file storage, OpenTelemetry.
- The standards are tailored to this profile (ADR-0019). Where any document
  conflicts with `docs/PRODUCT.md`, PRODUCT.md wins.
- **Check before assuming.** Grep for code before referencing it, and check
  `git log origin/main` before relying on anything in this file.

## 3. How to work

Classify every change before starting. The gates for each class, approval,
reviewer findings, releases and maintenance are in
[`docs/PROCESS.md`](docs/PROCESS.md) — the canonical detail.

| Class             | Examples                                                                                     | What you do                                             |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Trivial**       | Typo, docs wording, dependency patch                                                         | Just do it                                              |
| **Small**         | Bug fix, contained tweak; one PR, no schema or contract break                                | State a 3–5 bullet plan, then proceed                   |
| **Feature**       | New capability, model or endpoint; more than one PR                                          | `/feature` → feature doc; wait for the owner's approval |
| **Architectural** | New infrastructure, superseding an ADR, diverging from the template, major dependency change | `/adr`; wait for the owner's approval                   |

**Escalation triggers** — each raises the class by at least one: a database
migration; auth or ownership code; a new runtime dependency or service; a
breaking OpenAPI change; a change to a CI or security gate.

- Ask for approval with **AskUserQuestion**, recommended option first.
- **The owner merges.** Merge only when told to in this session, only with CI
  green, and never the "Version Packages" release PR unless asked.

## 4. Non-negotiables

- **Ownership:** services check `principal.owns(row)`; another owner's row returns
  the same 404 as a missing row (ADR-0016, `docs/SECURITY_STANDARDS.md`).
- **Validation:** DTOs validate every input; rules both apps enforce live in
  `@repo/types` (ADR-0017).
- **Features come from the template:** `pnpm gen:feature <entity>`, then adapt
  (`docs/REFERENCE_FEATURE.md`). Do not diverge from its cross-cutting patterns
  without an ADR (ADR-0015). Change the template when a cross-cutting standard
  changes.
- **UI:** semantic tokens and shared components only — no one-off styling
  (`docs/DESIGN_SYSTEM.md`). Desktop-first for ≥ 1280px.
- **Accessibility:** WCAG 2.2 AA is a merge requirement, including reflow at
  400% zoom (`docs/ACCESSIBILITY.md`).
- **No secrets in git.** Never disable TLS verification.
- **Never weaken a gate** (CI, lint, security, accessibility) to get green.
- **Every bug fix ships a regression test**; every feature ships tests
  (`docs/TESTING.md`).
- **Do not merge red.**

## 5. Commands & verification

Before calling work done, run and report honestly:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check
```

- **After any API change:** `pnpm contract:generate`, then `git status`; commit
  `apps/api/openapi.json` and `packages/types/src/openapi.gen.ts`. CI fails on
  drift.
- **API e2e** (`pnpm --filter @repo/api test:e2e`; suites skip when
  `DATABASE_URL` is unset):
  1. `pnpm --filter @repo/types build`;
  2. point `DATABASE_URL` at an `app_test` database (as CI does) and apply
     migrations with `pnpm --filter @repo/api prisma:deploy`;
  3. the API port variable is `API_PORT` (default 3000), not `PORT`.
- **Accounts:** `pnpm db:seed` (dev account `dev@example.com` /
  `dev-password-123`), `pnpm user:create`, `pnpm user:reset-password`.
- **Codespace gotchas** ([`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md#codespace-specifics)):
  - Docker blocks container-to-container traffic, so `docker compose up` fails
    at migrate. Run `pnpm dev` against the Postgres container instead.
  - A git worktree needs a full `pnpm install`; filtered installs leave packages
    unlinked, and the git hooks need `node_modules`.
  - Restart dev servers by port, never with `pkill -f <pattern>`.
- Setup and everyday commands: `docs/DEVELOPMENT.md`; the server:
  `docs/OPERATIONS.md`.

## 6. Git & PR mechanics

- Branch from `main`: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>`.
  Never commit to or force-push `main`.
- **Conventional Commits**, enforced by commitlint — allowed types and scopes are
  in `commitlint.config.js`. Imperative, lower-case subject, no trailing period.
  Breaking change: `!` plus a `BREAKING CHANGE:` footer.
- Never skip hooks (`--no-verify`).
- One logical change per PR; rebase on `main`; squash-merge with a Conventional
  Commit title.
- **Changesets** (`pnpm changeset`) only for changes to the running app (api, web
  or shared runtime code) — not for docs, CI or tooling.
- PR body: fill in every section of `.github/pull_request_template.md` (`/ship`
  does this).

## 7. Agents & skills

- Subagents, their triggers and the reviewer output contract:
  [`.claude/agents/README.md`](.claude/agents/README.md).
- Skills: `/ship`, `/review`, `/feature`, `/deps`, `/release`, `/adr`
  ([`.claude/skills/`](.claude/skills/README.md)).
- Reviewer findings are advice: reproduce each before acting on it.
- [`.claude/settings.json`](.claude/settings.json) pre-approves the read-only
  gates, blocks pushes to `main`, force pushes and `.env` edits, and formats
  edited files. Any change to it needs the owner's entry-by-entry approval.

## 8. Where things live

| Topic                                | Canonical document                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Product profile, non-goals           | [`docs/PRODUCT.md`](docs/PRODUCT.md)                                                                       |
| System overview                      | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                                                             |
| Frontend structure, state, routing   | [`docs/FRONTEND_ARCHITECTURE.md`](docs/FRONTEND_ARCHITECTURE.md)                                           |
| Tokens and components                | [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md), [`docs/COMPONENT_LIBRARY.md`](docs/COMPONENT_LIBRARY.md) |
| UX: shell, keyboard, feedback, forms | [`docs/UX_STANDARDS.md`](docs/UX_STANDARDS.md)                                                             |
| Accessibility (WCAG 2.2 AA)          | [`docs/ACCESSIBILITY.md`](docs/ACCESSIBILITY.md)                                                           |
| Frontend budgets and test matrix     | [`docs/FRONTEND_QUALITY.md`](docs/FRONTEND_QUALITY.md)                                                     |
| Backend modules and layering         | [`docs/BACKEND_ARCHITECTURE.md`](docs/BACKEND_ARCHITECTURE.md)                                             |
| REST conventions and envelopes       | [`docs/API.md`](docs/API.md)                                                                               |
| Schema rules                         | [`docs/DATABASE.md`](docs/DATABASE.md)                                                                     |
| Security, ownership, auth            | [`docs/SECURITY_STANDARDS.md`](docs/SECURITY_STANDARDS.md)                                                 |
| Logging and health                   | [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md)                                                           |
| Backend performance                  | [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)                                                               |
| Feature template                     | [`docs/REFERENCE_FEATURE.md`](docs/REFERENCE_FEATURE.md)                                                   |
| Tests and CI jobs                    | [`docs/TESTING.md`](docs/TESTING.md)                                                                       |
| Local development                    | [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)                                                               |
| Versioning and releases              | [`docs/RELEASING.md`](docs/RELEASING.md)                                                                   |
| Self-hosting runbook, backups        | [`docs/OPERATIONS.md`](docs/OPERATIONS.md)                                                                 |
| Delivery process                     | [`docs/PROCESS.md`](docs/PROCESS.md)                                                                       |
| Feature docs                         | [`docs/features/`](docs/features/README.md)                                                                |
| Architectural decisions (immutable)  | [`docs/adr/`](docs/adr/)                                                                                   |
| Smaller decisions, newest first      | [`docs/DECISIONS.md`](docs/DECISIONS.md)                                                                   |
| Known debt with remediation intent   | [`docs/TECH_DEBT.md`](docs/TECH_DEBT.md)                                                                   |
| Now / Next / Later, candidate work   | [`docs/PRODUCT.md`](docs/PRODUCT.md#roadmap), [`docs/BACKLOG.md`](docs/BACKLOG.md)                         |

An **ADR** records an architecturally significant, hard-to-reverse choice
(supersede, never edit). **DECISIONS.md** logs smaller choices. **TECH_DEBT.md**
tracks shortcuts we mean to fix. PRODUCT.md's **Roadmap** holds scheduled work;
**BACKLOG.md** holds unscheduled candidates.

## 9. Keeping docs true

- Update the affected docs in the same PR as the change.
- State each rule once, in its canonical document; link to it from elsewhere.
- When a decision flips, add its tell-tale terms to `STALE_TERMS` in
  `scripts/check-docs.mjs` so `pnpm docs:check` catches leftovers.
- Keep this file under about 170 lines. If it grows, move detail into the
  canonical document and link to it.
