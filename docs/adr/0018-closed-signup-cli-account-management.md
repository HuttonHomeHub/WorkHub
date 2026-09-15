# ADR-0018: Closed sign-up with server-side account management

- **Status:** Accepted (amends the sign-up clause of ADR-0016)
- **Date:** 2026-09-15
- **Deciders:** Project owner

## Context

ADR-0016 gave the base **open self-signup**: anyone who can reach the app can
create an account. It also noted that email flows (verification, password
reset) need an SMTP integration, which does not exist — so today a forgotten
password can only be fixed by editing the database.

The first app on this base (WorkHub) has **a single user**, self-hosted behind
the owner's reverse proxy. For that shape, open sign-up is an unnecessary attack
surface (anyone who finds the URL can register), and building email delivery
(provider, DNS, templates, verification and reset pages) is significant
ongoing cost for a flow nobody needs. Developers also want to get past the
sign-in screen without creating an account by hand each time.

## Decision

1. **Public sign-up is off by default.** `AUTH_SIGNUP_ENABLED` (default
   `false`) maps to Better Auth's `emailAndPassword.disableSignUp`, which the
   sign-up endpoint enforces server-side. Apps where anyone may register set it
   to `true`; nothing else changes.
2. **The web client asks, it doesn't guess.** A public
   `GET /api/v1/config` returns `{ signUpEnabled }`; the sign-in page offers the
   sign-up link only when enabled, and `/sign-up` redirects to sign-in when not.
3. **Accounts are managed from the server, without email.**
   `pnpm user:create --email … --name …` and
   `pnpm user:reset-password --email …` (also runnable inside the api container
   as `node dist/cli/user.js …`) use Better Auth's own password hashing and
   storage, apply the shared account rules (ADR-0017), and a reset signs out the
   account's existing sessions.
4. **Development has a known account.** `pnpm db:seed` (run by `setup.sh`)
   creates or resets `dev@example.com`; it refuses to run with
   `NODE_ENV=production`. There is deliberately no authentication bypass.

Owner-based access (ADR-0016) is unchanged.

## Alternatives considered

- **Keep open sign-up** — zero work, but anyone can register on a public
  deployment, and password reset remains impossible. Rejected for the default.
- **Full email flows** (transactional provider, SPF/DKIM, templates,
  verification and "forgot password" pages) — the right answer when strangers
  sign up; heavy for a single-user app. Deferred: enable sign-up and add an
  email integration when an app needs it.
- **Better Auth admin plugin** (admin role + user-management API) — reintroduces
  the admin role ADR-0016 rejected and needs a UI or API client to use. A small
  CLI covers the need without a role model.
- **A dev-only auth bypass** — fastest locally, but bypass switches have a way
  of reaching production. Rejected in favour of a seeded account.

## Consequences

- **Positive:** no public registration surface by default; password reset
  exists without email; developers sign in with a documented account.
- **Negative / trade-offs:** creating the first account on a server is a manual
  step (`docker compose exec api node dist/cli/user.js create …`); the CLI uses
  Better Auth's internal adapter, so Better Auth upgrades must keep it green
  (covered by `apps/api/test/accounts.e2e-spec.ts`). The dev password is in the
  repo — acceptable because the seed refuses production.
- **Follow-ups:** apps that enable public sign-up should add email verification
  and reset flows before launch.

## References

- ADR-0003 (Better Auth), ADR-0016 (owner-based access), ADR-0017 (shared rules)
- `docs/SECURITY_STANDARDS.md` → Authentication, `docs/DEVELOPMENT.md`,
  `docs/DEPLOYMENT.md`
