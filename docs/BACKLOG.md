# Backlog

Candidate work that is **not yet scheduled** — one line per item, with a rough
size (S/M/L). Scheduled work is in PRODUCT.md's
[Now / Next / Later](PRODUCT.md#roadmap); known shortcuts are in
[TECH_DEBT.md](TECH_DEBT.md).

Claude updates this file in the PR that finishes or schedules an item: delete a
finished item; move a scheduled one to PRODUCT.md.

- `S` Lint PR titles in CI with commitlint (squash-merge titles skip the local
  hook); Dependabot's `chore(deps-dev)` prefix must pass the scope list.
- `S` Automated contrast check of the design tokens in `globals.css` (every
  fill/foreground pair meets WCAG AA in light and dark).
- `M` Extend `pnpm gen:feature` to scaffold the frontend side (`api/` hooks on
  `apiClient`, list route, form) so the web pattern is generated and CI-verified.
- `S` Review the template's indexes with database-architect: `@@index([ownerId])`
  is a prefix of `@@index([ownerId, status])`, and lists order by `createdAt`.
- `M` Enforce the soft-delete filter globally with a Prisma client extension once
  a second model exists.
- `S` Tune per-route rate limits for sensitive endpoints as they appear.
- `S` Bundle-size budget check for the web app in CI.
- `S` Dependency licence check in CI.
