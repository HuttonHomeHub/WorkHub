# WorkHub — product profile

> What WorkHub is, who it is for, and the product decisions every standard is
> measured against. Recorded by [ADR-0019](adr/0019-workhub-single-owner-desktop-app.md).
> Where an older standards document conflicts with this file, **this file wins**
> until that document is rewritten.

## Purpose

**TBD.** The domain has not been chosen yet.

WorkHub is one product, not a starter: a private, self-hosted web app for a
single owner, built on a TypeScript monorepo (React + NestJS + PostgreSQL). Today
it is a walking skeleton — sign-in, a protected shell and `/api/v1/me` — waiting
for its first domain feature. When the purpose is decided, replace this section
and fill in the glossary below.

## Users

- **One owner.** There are no teams, roles, sharing or admin screens.
- **Public sign-up is closed.** Accounts are created and passwords reset from the
  server CLI (`pnpm user:create`, `pnpm user:reset-password`) — ADR-0018.
- **Ownership checks stay.** Every resource carries an `owner_id` and services
  return 404 for rows the caller does not own (ADR-0016). With one user this is
  cheap insurance, not a multi-user model.

## Platform & interaction

- **Desktop web browser only:** Chromium and Firefox, both run in CI (CI runs
  Chromium only until Firefox is added). Safari is not supported. No phone,
  tablet or touch design.
- **Designed for windows ≥ 1280px wide**, up to 2560px and beyond. Narrower
  windows must not break (no lost content or function), but they are not a
  design target.
- **Input:** keyboard and mouse.
- **Shortcuts:** a command palette on **Ctrl/Cmd+K** only. No other custom or
  single-key shortcuts for now; standard browser and form keys keep working.

## UI decisions

- **Compact density:** 14px body text; 32px controls and table rows.
- **Layout:** a collapsible left sidebar (icon rail) and, where a feature needs
  it, list/detail split panes.
- **Destructive actions:** act immediately and offer an **undo toast** by
  default. A confirmation dialog is only for actions that cannot be undone.
- **Theme:** light, dark, and follow-the-system.

## Accessibility

**WCAG 2.2 AA is a merge requirement.** Desktop-only does not relax it: full
keyboard operation, visible focus, contrast, and **1.4.10 reflow at 400% zoom**
all apply.

## Locale

One locale, currency and timezone, set in one place — no internationalisation or
multi-currency support:

| Setting  | Value                                   |
| -------- | --------------------------------------- |
| Locale   | `en-GB`                                 |
| Currency | GBP, stored as **integer pence**        |
| Timezone | `Europe/London` (store UTC, show local) |

## Hosting & security posture

- **Self-hosted Docker Compose**, one API instance, behind the owner's reverse
  proxy, which terminates TLS.
- **Internet-facing.** Anyone can reach the sign-in page, so login hardening is
  required **before the first public deployment**:
  - **Passkeys** as the second factor, with recovery through the server CLI;
  - an explicit session policy (lifetime, idle timeout, sign-out everywhere);
  - a brute-force posture for the auth routes behind the proxy;
  - strong, generated secrets.
- **Images** are published to GHCR for amd64 today; arm64 (multi-arch) is
  planned — see Next.
- **Releases** use Changesets. Only changes to the running app get a changeset;
  a release is cut when the owner wants to deploy.

## Data safety

Planned, not built yet:

- a nightly `pg_dump` on the host;
- an **encrypted off-site copy** (for example restic to S3-compatible storage or
  Backblaze B2);
- retention of **7 daily, 4 weekly and 6 monthly** backups;
- a heartbeat alert when a backup is missed;
- a documented, rehearsed restore drill.

## Scale

One owner, one API instance, one PostgreSQL database. Data volumes are personal
scale. Performance work is driven by measurement on this shape, not by
hypothetical load.

## Non-goals

- Phone, tablet or touch layouts.
- Multi-user collaboration: teams, roles, sharing, organisations.
- Internationalisation, multiple currencies or timezones.
- Horizontal scaling, multiple API instances, or a shared cache.
- Public self-registration.

## Deferred infrastructure

Not built; use these defaults when a feature first needs one (ADR-0019):

| Need            | Default                                                     |
| --------------- | ----------------------------------------------------------- |
| Background jobs | pg-boss, or an in-process scheduler for simple timers       |
| Caching         | none shared; in-process memoisation only when measured      |
| File storage    | a mounted, backed-up Docker volume behind a storage service |
| Observability   | Pino logs with correlation IDs; OpenTelemetry deferred      |

## Glossary

Placeholder — define domain terms here once the purpose is known, and use them
consistently in code, UI copy and docs.

## Feature inventory

What exists today:

| Area        | Capability                                                        |
| ----------- | ----------------------------------------------------------------- |
| Auth        | Email/password sign-in and sign-out, sessions (Better Auth)       |
| Accounts    | CLI create and reset-password; seeded `dev@example.com` locally   |
| Web         | Protected shell with a theme toggle                               |
| API         | `GET /api/v1/me`, `GET /api/v1/config`, health endpoints, OpenAPI |
| Feature kit | `pnpm gen:feature` from the reference template (ADR-0015)         |
| Delivery    | CI (quality, template, e2e), Changesets, GHCR images              |

Not built: domain features, passkeys, backups, the sidebar and command palette.

## Roadmap

Scheduled work, updated in the PR that starts or finishes an item. Sizes: S
(one PR), M (a few PRs), L (a feature doc and several slices). Unscheduled
candidates are in [BACKLOG.md](BACKLOG.md).

### Now

- Nothing in progress. The ADR-0019 standards rewrite (steps 3–6) is done; the
  next item comes from Next.

### Next

- `M` Backups: nightly dump, encrypted off-site copy, restore drill, data export.
- `L` Login hardening — passkeys, session policy, brute-force posture; required
  before the first public deployment.
- `L` App shell: sidebar rail, density, layout, z-index and motion tokens (32px
  controls), three-way theme, router pending and error states, skip link and
  landmarks — per UX_STANDARDS.md and DESIGN_SYSTEM.md.
- `M` CI: Docker image build, Firefox e2e at 1280×800 and 1920×1080, multi-arch
  (amd64 + arm64) images.

### Later

- `L` First domain feature (purpose TBD).
- `M` Command palette (Ctrl/Cmd+K).
- `S` Error-code catalogue for API errors.
