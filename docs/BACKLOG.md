# Backlog

> **Pending rewrite (ADR-0019).** Parts of this document assume a generic base repository rather than WorkHub — where it conflicts with [PRODUCT.md](PRODUCT.md), PRODUCT.md wins.

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

> No product backlog yet: WorkHub's purpose is still to be decided
> ([PRODUCT.md](PRODUCT.md)). Sign-in with closed sign-up is live (ADR-0016,
> ADR-0018). Work already decided — passkeys, backups, the app shell and command
> palette — is listed in PRODUCT.md and ADR-0019 until this file is rewritten.

## Engineering / platform (unscheduled)

- `M` Observability: metrics + tracing backend selection.
- `S` Per-route rate-limit tuning for sensitive Nest endpoints as they appear.
- `S` Bundle-size budget checks in CI for the web app.
- `M` Performance budget/Lighthouse CI on key pages.
- `S` Dependency license checking in CI.
