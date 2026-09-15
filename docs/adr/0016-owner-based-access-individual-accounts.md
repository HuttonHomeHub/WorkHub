# ADR-0016: Owner-based access for individual accounts

- **Status:** Accepted (supersedes ADR-0012)
- **Date:** 2026-07-12
- **Deciders:** Project owner, Backend architecture, Security

## Context

ADR-0012 defined organisation-scoped RBAC for a multi-tenant shape: users belong
to organisations, roles are per-membership, and permissions gate every route.
The applications this template will actually produce are different: **multiple
individual users, each their own tenant** — no organisations, no shared
resources, no role hierarchy, and **open self-signup with no admin role**.

Carrying the full RBAC machinery for that shape would be permanent accidental
complexity: every feature would define permission codes and role mappings that
always resolve to "the owner may do everything, everyone else nothing".

## Decision

**Owner-based access control**: every domain resource carries an `owner_id`
column referencing `users.id`, and authorisation is the single question _"does
the authenticated user own this resource?"_

- **Accounts are individual.** Open email/password signup via Better Auth
  (ADR-0003); no roles, no admin, no organisations.
- **The principal is just the user** (`userId`, `email`, `name`) with one
  capability check: `principal.owns(resource)`.
- **Enforcement stays deny-by-default**: the global authentication guard
  rejects unauthenticated requests to any route not marked `@Public()`. The
  `PermissionsGuard`/`@RequirePermissions()` layer is removed.
- **Services are the authorisation layer** (defence against IDOR):
  - **Creates** always set `ownerId` from the session principal — never from
    client input.
  - **Lists** are always scoped `WHERE owner_id = principal.userId`.
  - **Reads/updates/deletes** load the row, then check ownership. A row owned
    by someone else returns the **same 404 as a missing row**, so resource ids
    cannot be probed for existence.
- The reference-feature template (ADR-0014/0015) demonstrates the pattern and
  `scripts/verify-template.sh` keeps it enforced.

## Alternatives considered

- **Keep organisation RBAC (ADR-0012)** — correct for team/multi-tenant
  products, pure overhead here; every check degenerates to ownership. Rejected
  for this template's target apps.
- **Owner model + admin role** — an `is_admin` flag and user management UI.
  Explicitly not wanted (open signup, flat accounts). Reintroduce later via a
  new ADR if operational needs demand it; Better Auth's admin plugin makes
  this a contained change.
- **Per-resource ACLs / sharing** — needed only if users ever share resources
  with each other. Out of scope; would supersede this ADR.

## Consequences

- **Positive:** radically simpler authorisation that cannot drift (one check,
  enforced in one service helper); fewer moving parts in guards, DTOs, and
  tests; anti-enumeration 404 semantics by default.
- **Negative / risks:** if a future app needs teams, roles, or sharing, this
  ADR must be superseded and `owner_id` columns generalised (e.g. back to an
  organisation scope). The migration path is mechanical but touches every
  domain table.
- **Neutral:** Better Auth's schema keeps `users`/`sessions`/`accounts`/
  `verifications` unchanged, so swapping the authorisation model later does
  not disturb authentication.
- Follow-ups: none — docs, template, and CI were updated with this ADR.

## References

- Supersedes [ADR-0012](0012-authorization-rbac-scoped.md)
- Authentication: [ADR-0003](0003-authentication-with-better-auth.md)
- Template enforcement: [ADR-0014](0014-reference-feature-as-non-shipping-template.md),
  [ADR-0015](0015-template-driven-feature-development.md)
