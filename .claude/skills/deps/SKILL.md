---
name: deps
description: >-
  Use when Dependabot PRs have piled up or the owner asks for a dependency pass:
  combines compatible updates into one verified branch with a single lockfile
  change, closes the superseded Dependabot PRs, and records deferred majors.
  Merges only when told.
---

# Dependency pass

Precedent: the grouped passes in `git log` (e.g. "update app and dev
dependencies") and the 2026-09-15 dependency entry in `docs/DECISIONS.md`.

1. **List** open Dependabot PRs: `gh pr list --author app/dependabot`.
2. **Sort** them into patch/minor updates and majors. For each major, check the
   pins and reasons in `.github/dependabot.yml` and `docs/TECH_DEBT.md`; a major
   that needs a migration (config changes, new adapters) is deferred or planned
   separately — it may be Architectural.
3. **Branch** `chore/deps-<yyyy-mm-dd>` from `origin/main`. Apply the compatible
   updates in the relevant `package.json` files and `pnpm-workspace.yaml`
   catalog, then run `pnpm install` once, so there is a **single lockfile
   change**. Include GitHub Actions and Docker base image bumps if open.
4. **Verify:** the gates
   (`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check`),
   `pnpm build`, `pnpm contract:generate` then `git status` (no drift), and API
   e2e plus Playwright where a database and browsers are available. Read
   changelogs for anything touching auth, Prisma or the build.
5. **Changeset** only if a runtime dependency of the running app changed
   (patch).
6. **Ship** with `/ship`. The PR body lists every Dependabot PR it supersedes and
   every update deferred, with the reason.
7. **Close** superseded Dependabot PRs with a comment linking the combined PR
   (`gh pr close <n> --comment "Superseded by #<combined>"`) — only after the
   combined PR is open.
8. **Record** deferred majors: add or update the `TECH_DEBT.md` row and the
   `dependabot.yml` ignore comment in the same PR.
9. **Merge only** when the owner says so in this session, with CI green.
