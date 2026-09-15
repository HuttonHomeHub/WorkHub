# Backlog

Candidate work that is **not yet scheduled**. This is a grooming space; once an
item is ready and prioritised, promote it to a GitHub issue (with acceptance
criteria) and, if it shapes the product, reflect it in [ROADMAP.md](ROADMAP.md).

> Convention: keep items outcome-focused. Prefix with a rough size —
> `S`/`M`/`L` — when known. Remove items once they become issues or are done.

## Foundation follow-ups (near-term)

- `S` Add a PR-title/commit lint check to CI (belt-and-braces with the git hook).
- `S` Add Changesets bot permissions & branch protection rules.
- `S` Add an automated design-token contrast check (parse `globals.css`, verify
  WCAG AA for all fill/foreground pairs) and run it in CI.
- `M` Extend `pnpm gen:feature` to scaffold the matching **frontend** feature
  (`api/` hooks on `apiClient`, list route, form) so the frontend pattern is
  generated and CI-verified too.
- `S` Review the template's indexes with the database-architect agent:
  `@@index([ownerId])` is a leftmost prefix of `@@index([ownerId, status])`, and
  the list query orders by `createdAt`, which suggests `(owner_id, created_at)`.
- `M` Centralise the soft-delete filter via a Prisma client extension (so it's
  enforced globally, not per-repository) once a second model exists.

## Product (unscheduled)

> Blank App is a base repository with **no product backlog of its own**. When you
> build an application, list its candidate features here. Common building blocks
> the foundation already supports (add when a real feature needs them):
> notifications (BullMQ), file uploads (object storage), email (SMTP for
> verification/password reset — see ADR-0016), and internationalisation.
> Authentication + individual accounts are already live (Better Auth, ADR-0016).

## Engineering / platform (unscheduled)

- `M` Observability: metrics + tracing backend selection.
- `S` Per-route rate-limit tuning for sensitive Nest endpoints as they appear.
- `S` Bundle-size budget checks in CI for the web app.
- `M` Performance budget/Lighthouse CI on key pages.
- `S` Dependency license checking in CI.
