---
name: ship
description: >-
  Use when a change is ready to go up as a pull request: classifies it, runs the
  gates, adds a changeset only if the running app changed, commits, pushes, opens
  a PR from the template and watches CI. Merges only if the owner said so in this
  session.
---

# Ship a change

Follow `docs/PROCESS.md` and `CLAUDE.md` §5–6.

1. **Classify** the change (Trivial / Small / Feature / Architectural) and note
   any escalation trigger. A Feature or Architectural change needs its approved
   feature doc or ADR first — if it is missing, stop and say so.
2. **Review:** for anything above Trivial, make sure `/review` has run on the
   final diff and its dispositions are ready for the PR body.
3. **Run the gates** and keep the output:
   `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm docs:check`.
   - After an API change: `pnpm contract:generate`, then `git status`; commit
     `apps/api/openapi.json` and `packages/types/src/openapi.gen.ts`.
   - When endpoints or data access changed: run API e2e
     (`pnpm --filter @repo/types build`; `DATABASE_URL` at `app_test`;
     `pnpm --filter @repo/api prisma:deploy`; `pnpm --filter @repo/api test:e2e`).
   - Fix failures; never weaken a gate. Report anything you could not run.
4. **Changeset** (`pnpm changeset`) only if `apps/api`, `apps/web` or shared
   runtime code in `packages/types` changed behaviour. Not for docs, CI or
   tooling.
5. **Branch and commit:** on `type/slug` from `origin/main` (never `main`).
   Conventional Commits, hooks on (never `--no-verify`), and the attribution
   lines the session requires.
6. **Push** the branch and **open the PR** with `gh pr create`, a Conventional
   title, and a body filled from `.github/pull_request_template.md`: Summary,
   Change class, How has this been tested (commands + results), Reviews run, Risk
   & rollback, Changeset.
7. **Watch CI** (`gh pr checks --watch`) and report the PR URL and results.
   Fix red checks on the branch.
8. **Merge only** if the owner told you to in this session and CI is green —
   `gh pr merge --squash`. Otherwise stop: the owner merges.
