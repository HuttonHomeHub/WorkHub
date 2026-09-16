# Security standards

> The canonical home of WorkHub's security rules: authentication, sessions,
> ownership, input handling, secrets, proxy trust, rate limiting, headers,
> dependencies and auth security events. How to report a vulnerability is in
> [SECURITY.md](../SECURITY.md). Backed by ADR-0003 (Better Auth), ADR-0016
> (ownership), ADR-0017 (shared validation) and ADR-0018 (closed sign-up).

## Threat model

WorkHub holds one owner's personal data and is **internet-facing**: anyone can
reach the sign-in page through the owner's reverse proxy ([PRODUCT.md](PRODUCT.md)).
The realistic attacks are credential stuffing and password guessing against
sign-in, session theft, a missing ownership or validation check, a leaked
secret, and a vulnerable dependency. There are no other users to attack each
other, so the rules below concentrate on the front door and the data.

**Rules marked _required before exposure_ are not built** and must ship before
the first public deployment (PRODUCT.md → Next, "Login hardening"). Until then
run WorkHub only where the internet cannot reach it.

## At a glance

| Control                                              | Today                                                                  | Required before exposure                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Sign-in                                              | Email and password (Better Auth)                                       | **Passkey as a second factor**; recovery via the server CLI            |
| Sign-up                                              | Closed; accounts from the CLI (ADR-0018)                               | —                                                                      |
| Session lifetime                                     | Better Auth defaults, not configured: 7 days, extended daily when used | **An explicit policy**: absolute lifetime and idle timeout             |
| Sign-out                                             | Current session; a CLI password reset ends all sessions                | **Sign out everywhere** from the app                                   |
| Brute force                                          | Per-IP limits on `/api/auth/*` and Nest routes                         | **A per-account posture** that survives IP rotation                    |
| Auth security events                                 | Not logged                                                             | **Logged** ([OBSERVABILITY.md](OBSERVABILITY.md#auth-security-events)) |
| Ownership, validation, secrets, proxy trust, headers | In place (below)                                                       | —                                                                      |

## Authentication

- **Better Auth** (ADR-0003) owns `/api/auth/*`. Passwords are hashed by Better
  Auth; the session token lives in an **http-only cookie** that client
  JavaScript cannot read. The cookie is `Secure` when `BETTER_AUTH_URL` is
  `https`, which it must be in production.
- **Deny by default.** The global `AuthenticationGuard` resolves the principal
  from the session cookie through `AuthContextService` and returns **401** for
  any Nest route not marked `@Public()`.
- **`@Public()` inventory.** These are the only public Nest routes; a PR that
  adds one updates this table with its reason:

  | Route                | Why it is public                                     |
  | -------------------- | ---------------------------------------------------- |
  | `GET /health`        | Liveness probe for Docker and uptime monitoring      |
  | `GET /health/ready`  | Readiness probe; reports only up/down per dependency |
  | `GET /api/v1/config` | Non-sensitive flags the signed-out screens need      |

  `/api/auth/*` is public by design and protected by Better Auth's own checks
  and limiter.

- **Closed sign-up** (ADR-0018): with `AUTH_SIGNUP_ENABLED=false` (the default)
  Better Auth refuses sign-up server-side. Accounts are created with
  `pnpm user:create` and passwords reset with `pnpm user:reset-password` (or
  `node dist/cli/user.js` in the api container). There are no email flows.
- **The development account** from `pnpm db:seed` has a published password; the
  seed refuses to run with `NODE_ENV=production`.

### Passkeys — required before exposure

- Better Auth's passkey plugin, as a **second factor after the password** for
  the owner's account (ADR-0019).
- Registering or removing a passkey requires an authenticated session.
- **Recovery is server-side only:** a CLI command removes the passkeys of an
  account. There is no SMS, email or recovery-code flow to attack.
- The login-hardening feature doc settles the details (enrolment prompt, what
  happens with no passkey registered).

### Sessions — required before exposure

- **Today** no `session` options are set in `apps/api/src/common/auth/auth.instance.ts`,
  so Better Auth's defaults apply: a session expires 7 days after it was last
  extended, and each use more than a day after the last extension extends it.
  An active owner is never signed out.
- **Required:** an explicit policy in code — an absolute maximum lifetime, an
  idle timeout, and re-authentication when either passes — with e2e tests.
- **Sign out everywhere:** the owner can end every session from the app (Better
  Auth can revoke all of a user's sessions), and a password reset or passkey
  change does it automatically. The CLI reset already does.
- Expiry never loses work silently: the web re-authenticates and returns the
  owner to where they were ([ACCESSIBILITY.md](ACCESSIBILITY.md) → timing).

## Authorisation — ownership (ADR-0016)

With one owner this is cheap insurance, not a tenancy model — and it is still a
merge requirement.

- Every domain row carries `owner_id` → `users.id`.
- **Creates** take the owner from the session principal, never from the body.
- **Lists** filter `ownerId: principal.userId` in the query itself.
- **Reads, updates and deletes** load the row, then call `principal.owns(row)`.
  A row owned by someone else returns **the same 404 as a missing row**, so ids
  cannot be probed. The template's `findOwnedOrThrow` is the pattern.
- A missing ownership check is a blocking finding.

## Input validation

- **Every body and query is a `class-validator` DTO** checked by the global
  `ValidationPipe` with `whitelist`, `forbidNonWhitelisted` and `transform`:
  unknown fields are rejected, types coerced, lengths and ranges bounded. Path
  ids go through `ParseUuidPipe`. Status codes and error shapes are in
  [API.md](API.md#status-codes).
- **Rules both apps enforce** (password and name lengths today) are constants in
  `@repo/types`, enforced by the API as well as the web form (ADR-0017).
- **Environment variables** are validated with Zod at startup; the API refuses to
  boot on bad configuration (`apps/api/src/config/env.validation.ts`).
- **Validation libraries:** API DTOs use `class-validator`; environment, CLI and
  web use Zod. Revisit at the NestJS 12 migration (DECISIONS.md, 2026-09-16).
- **Size limits:** JSON bodies are capped at Express's default 100 kB and
  lists at a maximum `limit` ([API.md](API.md#payload-limits)).

## Injection and output

- **Prisma only.** Raw SQL uses the tagged templates `$queryRaw`/`$executeRaw`,
  which parameterise; `$queryRawUnsafe`, `$executeRawUnsafe` and string-built
  SQL are forbidden.
- The API returns JSON only. The web never renders unsanitised HTML
  (`dangerouslySetInnerHTML` needs a sanitiser and a reason).
- **Errors are safe:** the global filter returns a generic `INTERNAL_ERROR` for
  anything unexpected, never a stack trace or driver message.

## CSRF and CORS

- Better Auth checks the `Origin` of state-changing auth requests against
  `CORS_ORIGINS`; its session cookie is `SameSite=Lax`.
- `CORS_ORIGINS` is an explicit allow-list with credentials. In production it is
  the single public origin (`APP_ORIGIN`), since the web and API share it.
- `GET` handlers have no side effects.

## Rate limiting and brute force

- **Two per-IP limiters, both on in production:**
  - `/api/auth/*` is outside the Nest router, so **Better Auth's limiter**
    covers it: sign-in and sign-up allow **3 requests per 10 seconds per IP**
    (Better Auth's defaults, on when `NODE_ENV=production`;
    `AUTH_RATE_LIMIT_ENABLED` forces it either way).
  - The **Nest throttler** covers every Nest route: `RATE_LIMIT_LIMIT` requests
    per `RATE_LIMIT_TTL` seconds per IP (default 100 per 60 s). Whether that is
    enough for a busy desktop table session is a backlog item.
  - Both return **429**.
- Counters are **in memory**, which is correct for the single API instance.
- **Required before exposure — per-account posture.** Per-IP limits do not stop
  a distributed guesser. The login-hardening feature decides the mechanism (for
  example a growing delay or temporary lock after repeated failures for the
  account, independent of IP, with a CLI unlock) and the passkey second factor
  removes most of the value of a guessed password.
- Sign-in failure messages do not reveal whether the email exists.

## Proxy trust

As shipped in `apps/api/src/app.setup.ts` and `auth.instance.ts`:

- `AUTH_TRUSTED_PROXIES` lists the IPs/CIDRs of the proxy hops (web nginx, the
  owner's reverse proxy). The compose files default it to the Docker networks
  (`172.16.0.0/12`); an empty value (local `pnpm dev`) trusts no proxy.
- The **same list** sets Express's `trust proxy` (the Nest throttler's client IP)
  and Better Auth's `ipAddress.trustedProxies` (its limiter's client IP), so
  `X-Forwarded-For` from any other peer is ignored and a client cannot pick its
  own rate-limit bucket (`apps/api/test/trust-proxy.e2e-spec.ts`).
- Use IPs or CIDRs only. Proxy set-up, including proxies on another host and
  Docker networks outside `172.16.0.0/12`, is in
  [OPERATIONS.md](OPERATIONS.md#reverse-proxy).

## Security headers

- **API:** Helmet with its defaults (CSP, HSTS, `X-Content-Type-Options`,
  frame and referrer policies) on every Nest response.
- **Web:** nginx sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`
  and `Referrer-Policy: strict-origin-when-cross-origin` on every response,
  assets included. Every `add_header` lives at server level in
  `apps/web/nginx.conf.template`, because a `location` that sets its own
  `add_header` silently drops all of them. A content security
  policy for the SPA is not set yet ([TECH_DEBT.md](TECH_DEBT.md)).
- **HSTS for the site** belongs on the owner's reverse proxy, which terminates
  TLS.
- **Swagger UI is off in production.** `main.ts` mounts `/api/docs` only when
  `NODE_ENV` is not `production`; keep it that way (a regression test is a
  backlog item).

## Secrets

- **No secrets in git, images or logs.** `.env` and `.env.production` are
  git-ignored; `.env.example` holds placeholders only. GitHub secret scanning
  and push protection should be enabled on the repository.
- **On the server** the secrets live in `.env.production` next to the compose
  file, owned by the deploying user with **mode 600**. Generate them with
  `openssl rand -base64 32` (`BETTER_AUTH_SECRET`) and
  `openssl rand -hex 32` (`POSTGRES_PASSWORD` — hex, because compose places it
  inside `DATABASE_URL`, where a `/` from base64 breaks the URL).
- **`BETTER_AUTH_SECRET`:** production refuses a value shorter than 32
  characters or containing a placeholder marker (`dev-insecure`, `change-me`,
  `changeme`, `<openssl`, `example`). **Rotating it signs every session out** —
  that is the way to force re-authentication everywhere.
- **`POSTGRES_PASSWORD`** is applied only when the database volume is first
  initialised. To rotate it, change the role's password first, then update
  `.env.production` and recreate the `migrate` and `api` containers
  ([OPERATIONS.md](OPERATIONS.md#rotate-postgres_password)).
- **One database role.** The compose files give `migrate` and `api` the same
  `POSTGRES_USER`, which the Postgres image creates as a superuser that owns the
  schema. A separate runtime role with data-only privileges is a backlog item;
  until then, the database is reachable only on the compose network (no host
  port in production).
- CI uses only the built-in `GITHUB_TOKEN` with least permissions per workflow.

## Auth security events

WorkHub has **no audit log** (ADR-0019). Security-relevant events go to the
structured application log with the correlation ID, the user id where known and
the client IP, and never a password, token or cookie. The event names and fields
are defined in [OBSERVABILITY.md](OBSERVABILITY.md#auth-security-events).

**Today none of them are logged:** Better Auth's handler runs before the request
logger, so `/api/auth/*` requests do not even appear in the request log. Adding
them is part of login hardening (BACKLOG.md).

## Dependencies

- **Justify every new runtime dependency** in the PR (need, maintenance, size);
  a new runtime dependency is an escalation trigger ([PROCESS.md](PROCESS.md)).
- **Dependabot** watches npm, GitHub Actions and Docker base images; security
  updates go first (`/deps`). Majors that cannot be taken yet are pinned in
  [TECH_DEBT.md](TECH_DEBT.md).
- CI and image builds install with `--frozen-lockfile`; review lockfile
  additions in dependency PRs.
- **CodeQL** runs on push, pull request and weekly — on a public repository. On
  a private one the job is skipped unless GitHub Advanced Security is enabled.

## Containers and host

Both images have health checks. The api image runs as the unprivileged `node`
user; the web image is stock nginx, whose master process runs as root with
unprivileged workers. Production exposes only the web container's port, bound to
`127.0.0.1` by default, and Postgres has no host port. Host, proxy, secret
rotation and backup procedures are in [OPERATIONS.md](OPERATIONS.md). Container
hardening (`no-new-privileges`, dropped capabilities, read-only filesystems,
memory limits, an unprivileged nginx image) is a backlog item.

## Data protection

- TLS ends at the owner's reverse proxy; traffic behind it stays on the host's
  Docker networks.
- Disk encryption on the host is the owner's choice; off-site backups are
  encrypted (planned, PRODUCT.md → Data safety).
- Logs never contain passwords, tokens, cookies or authorisation headers
  (redacted in `app.module.ts`), and never whole request bodies.
- The owner's own data export is planned ([DATABASE.md](DATABASE.md#data-export-planned)).

## Checklist

- [ ] Authenticated, or `@Public()` added to the inventory above with a reason
- [ ] Ownership: owner from the session; lists scoped; `owns(row)` → same 404
- [ ] DTOs bound every field; shared rules from `@repo/types`
- [ ] No raw SQL outside tagged templates; no unsanitised HTML
- [ ] No secrets or personal data in code, tests, logs or images
- [ ] Rate limits and proxy trust unchanged, or the change is tested
- [ ] Helmet and nginx headers not weakened; Swagger still off in production
- [ ] Auth changes log their security events and keep the before-exposure items on track
- [ ] New dependencies justified
