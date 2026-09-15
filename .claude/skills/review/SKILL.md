---
name: review
description: >-
  Use before shipping any change above Trivial, or when asked to review a branch:
  diffs against origin/main, picks reviewer agents by the paths touched, runs
  them in parallel, reproduces each blocking finding, and summarises dispositions
  for the PR body.
---

# Review a change

The agents and their output contract are in `.claude/agents/README.md`.

1. `git fetch origin`, then list changed paths:
   `git diff --name-only origin/main...HEAD` (plus uncommitted changes).
2. **Pick agents by path:**
   - `apps/web/src/**` → **ui-reviewer**; add **accessibility-reviewer** when
     interactive UI changed (components, forms, dialogs, panes, toasts, routes).
   - Controllers, DTOs, services, repositories in `apps/api/src/**` →
     **backend-reviewer**.
   - Auth, guards, sessions, `apps/api/src/config/**`, data access (repositories,
     ownership checks), auth UI, or new dependencies in any `package.json` →
     **security-reviewer**.
   - `apps/api/prisma/schema.prisma` or `apps/api/prisma/migrations/**` →
     **database-architect**.
   - `.github/**`, `**/Dockerfile`, `docker-compose*.yml`, nginx config,
     `.changeset/config.json` → **devops-reviewer**.
   - Behaviour changed without matching tests, or a bug fix without a
     regression test → **test-engineer**.
   - Docs-only changes need no agent; `pnpm docs:check` covers them.
3. **Run the chosen agents in parallel** (one message, several Agent calls).
   Give each the base ref, the changed paths, and the feature doc or ADR if any.
4. **Verify each Blocking finding** before acting: read the cited code, run the
   test or command, or reproduce the behaviour. Fix real ones; mark wrong or
   out-of-scope ones **dismissed** with a one-line reason.
5. Treat suggestions as optional; take the cheap, clearly right ones.
6. **Summarise** for the PR body's _Reviews run_ section:
   `agent → verdict; fixed: …; dismissed: … (reason)`.
