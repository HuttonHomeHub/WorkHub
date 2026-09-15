# Security Standards

> **Pending rewrite (ADR-0019).** Parts of this document assume an append-only audit log and object-storage buckets, and do not yet require passkeys for an internet-facing deployment — where it conflicts with [PRODUCT.md](PRODUCT.md), PRODUCT.md wins.

> Engineering security standards for Blank App — **security is enabled by default**,
> not opt-in. This complements the vulnerability-reporting policy in
> [`SECURITY.md`](../SECURITY.md) and `CLAUDE.md` §14. Backed by ADR-0003
> (auth) and ADR-0016 (authorisation).

## Principles

- **Secure by default, deny by default.** Every endpoint is authenticated and
  authorised unless explicitly public; every input is validated.
- **Least privilege** everywhere (DB roles, tokens, containers, buckets).
- **Defence in depth** — no single control is trusted alone.
- **The server never trusts the client.** All authorisation is re-checked
  server-side.

## Authentication

- **Better Auth** (ADR-0003): sessions in **secure, http-only, same-site
  cookies**; credentials hashed with a strong adaptive algorithm; no tokens in
  JS-accessible storage.
- A global authentication guard establishes the principal; unauthenticated
  requests get **401**. Sessions expire and can be revoked.
- Sensitive actions (password/email change, etc.) require re-authentication.
- **Closed sign-up by default** (ADR-0018): with `AUTH_SIGNUP_ENABLED=false`
  Better Auth refuses sign-up server-side and the web hides the page. Accounts
  are created and passwords reset with `pnpm user:create` /
  `pnpm user:reset-password`, which use Better Auth's hashing; a reset signs out
  every session of that account. Enable public sign-up only together with email
  verification.
- The development account from `pnpm db:seed` has a published password; the
  seed refuses to run with `NODE_ENV=production`.

## Authorisation — ownership (ADR-0016)

- **Owner-based access.** Accounts are individual; every domain resource
  carries an `owner_id` referencing `users.id`. The only capability question
  is _does the requester own the resource?_
- **Services enforce it on the loaded row** via `principal.owns(row)` — the
  authoritative check and the primary defence against **IDOR**. Creates always
  derive the owner from the session principal, never from client input; lists
  are always scoped to the principal's rows.
- **Anti-enumeration:** a resource owned by someone else yields the **same
  404** as a missing one — never a 403 that confirms existence.
- **Deny by default:** endpoints are protected unless `@Public()`.

## Secret management

- **No secrets in git — ever.** Config comes from the environment / a secret
  manager; `.env` is ignored, `.env.example` documents shape only.
- Secrets are rotated and scoped; separate secrets per environment. CI uses
  minimally-scoped tokens. Secret scanning + push protection are enabled.

## Input validation & output encoding

- **Validate all input at the boundary** with `class-validator` DTOs and a
  global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`).
  Reject unknown fields; enforce types, ranges, lengths, and formats.
- Rules the web also enforces (e.g. password and name length) come from
  `@repo/types` and are **enforced by the API** too — client-side checks are UX
  only (ADR-0017).
- Validate config at startup (Zod) — fail fast on bad config.
- **Output encoding / XSS:** the API returns JSON (no HTML rendering); the SPA
  escapes by default and must never inject unsanitised HTML
  (`dangerouslySetInnerHTML` is disallowed without sanitisation). Strict
  security headers via Helmet (API) and nginx (web), including a tight CSP.

## SQL injection

- **Prisma parameterised queries only.** No string-built SQL. On the rare raw
  query, use Prisma's tagged-template parameterisation — never interpolate user
  input.

## CSRF

- Cookie-based sessions ⇒ **CSRF protection on all state-changing requests**
  (Better Auth checks the `Origin` of state-changing requests against the trusted
  origins, plus same-site cookies). Safe methods (GET/HEAD) are side-effect-free.

## Rate limiting & abuse protection

- **Two layers, both on by default.** The global Nest throttler
  (`@nestjs/throttler`, `RATE_LIMIT_*`) covers the Nest routes. `/api/auth/*` is
  mounted outside the Nest router, so **Better Auth's limiter** covers it, with
  **stricter limits on sign-in/sign-up** (on in production;
  `AUTH_RATE_LIMIT_ENABLED` forces it either way). Both return **429** with a
  retry-after header.
- **Limits must be per client.** Behind proxies, `AUTH_TRUSTED_PROXIES` must list
  the proxy hops (the compose files default to the Docker network range);
  otherwise no client IP can be resolved and every client shares one bucket.
  Counters live in memory, i.e. per API instance — several instances need
  shared storage (see [`TECH_DEBT.md`](TECH_DEBT.md)).
- Guard against enumeration (uniform responses/timing on auth), and cap payload
  sizes and pagination limits server-side.

## Audit logging

- **Append-only audit log** for security- and sensitive events
  (authentication events, permission changes, sensitive mutations,
  deletions/exports): who, what, when, and before→after where relevant.
- Audit entries are **never mutated or deleted** and are separate from
  operational logs. **No secrets or full PII** in audit payloads.

## Dependency security

- **Dependabot** for updates; **CodeQL** + secret scanning in CI. Security
  updates are prioritised. **Justify every new dependency** (maintenance,
  footprint). `pnpm` build scripts are allow-listed, not run blindly.
- Pin the toolchain; `--frozen-lockfile` installs; review transitive additions.

## Docker & runtime security

- **Multi-stage builds**, minimal base images, **non-root** container user,
  read-only where possible, no secrets baked into images.
- Only necessary ports exposed; healthchecks defined; images carry **SBOM +
  provenance** (see [`DEPLOYMENT.md`](DEPLOYMENT.md)). Base images updated via
  Dependabot.
- **HTTPS everywhere** in deployed environments; internal services least-
  privileged and network-restricted.

## Data protection & privacy

- Encrypt in transit (TLS) and at rest (managed DB/bucket encryption).
- Minimise collected PII; never log secrets, tokens, full card/sensitive values,
  or PII (redaction in the logger — see [`OBSERVABILITY.md`](OBSERVABILITY.md)).
- Support erasure/export for privacy requests (hard delete path is explicit and
  audited).

## Secure-by-default checklist (per endpoint/feature)

- [ ] Authenticated (or explicitly `@Public()` with justification)
- [ ] Ownership check on every loaded resource (other users' rows → 404)
- [ ] DTO validation; unknown fields rejected; limits enforced
- [ ] Rate limiting appropriate to sensitivity
- [ ] No secrets/PII in logs; audit entry for sensitive mutations
- [ ] Errors return safe messages (no internals/stack traces)
- [ ] Parameterised queries only
