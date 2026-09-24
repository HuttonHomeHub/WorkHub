# WorkHub — product profile

> What WorkHub is, who it is for, and the product decisions every standard is
> measured against. Recorded by [ADR-0019](adr/0019-workhub-single-owner-desktop-app.md).
> Where an older standards document conflicts with this file, **this file wins**
> until that document is rewritten.

## Purpose

WorkHub is a set of modular tools that help the owner do and manage their job in
construction management and Home Office construction engineering, with data
shared across tools ([ADR-0020](adr/0020-modular-tools-over-shared-core-data.md)).

It is one product, not a starter: a private, self-hosted web app for a single
owner, built on a TypeScript monorepo (React + NestJS + PostgreSQL). The first
tool is the [hours tracker](features/hours-tracker.md).

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

Use these terms consistently in code, UI copy and docs. Tool-specific detail
lives in each tool's feature doc; the hours tracker's rules are in
[features/hours-tracker.md](features/hours-tracker.md).

| Term                          | Meaning                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tool**                      | A self-contained part of WorkHub with its own sidebar entry, routes, API modules and data, such as Hours (ADR-0020).                                                                      |
| **Core data**                 | Records more than one tool needs, such as bank holidays. Tools read them; core never depends on a tool (ADR-0020).                                                                        |
| **Work terms**                | The owner's effective-dated working settings: flexi targets, daily minimums, break rule, working band, caps and paid overtime allowed.                                                    |
| **Flexi target**              | The time a working day is expected to credit: 7:30 Mon–Fri, so 37:30 a week. Drives the flexi calculation.                                                                                |
| **Daily minimum**             | The least time to work on a day (7:30 Mon–Thu, 5:30 Fri). Raises a warning only; it never changes a number.                                                                               |
| **Flexi**                     | Credited time minus the flexi target, accrued day by day into a balance that can go negative.                                                                                             |
| **TOIL**                      | Time off in lieu, converted from excess flexi. It must be taken in the calendar month it is placed in.                                                                                    |
| **TOIL cap**                  | The most TOIL a calendar month can hold: 7:30. Converted time beyond it becomes overtime.                                                                                                 |
| **Overtime (paid or unpaid)** | Converted time over the TOIL cap, or TOIL unused at month end. Paid when paid overtime is allowed on that date, otherwise unpaid.                                                         |
| **Paid overtime allowed**     | A work terms setting, off by default, that makes overtime paid from its effective date.                                                                                                   |
| **Leave year and allowance**  | Leave runs 1 January to 31 December against an allowance in hours: 247:30, which includes bank holidays.                                                                                  |
| **Bought leave**              | An optional extra 37:30 of leave added to a single leave year.                                                                                                                            |
| **Bank holiday credit**       | 7:30 credited on a working day that is an England and Wales bank holiday, and deducted from the leave allowance.                                                                          |
| **Working band**              | The expected window for work, 07:00–19:00 by default. Time outside it raises a warning.                                                                                                   |
| **Settlement**                | The point at which a week's excess conversion applies: the week's last working day, Friday by default.                                                                                    |
| **Excess conversion**         | A per-week switch. When on, whole blocks (default 0:30) of the week's positive flexi at settlement become TOIL up to the cap, then overtime, spread across days; the rest stays as flexi. |

## Feature inventory

What exists today:

| Area        | Capability                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth        | Email/password sign-in and sign-out, sessions (Better Auth)                                                                                                                                                                     |
| Accounts    | CLI create and reset-password; seeded `dev@example.com` locally                                                                                                                                                                 |
| Web         | Protected shell with the tools sidebar and a three-way theme menu; the design system refreshed on 2026-09-24 ([app shell refresh](features/app-shell-refresh.md)): palette, Inter, type scale, 32px density, motion, focus ring |
| API         | `GET /api/v1/me`, `GET /api/v1/config`, health endpoints, OpenAPI                                                                                                                                                               |
| Feature kit | `pnpm gen:feature` from the reference template (ADR-0015)                                                                                                                                                                       |
| Delivery    | CI (quality, template, e2e), Changesets, GHCR images                                                                                                                                                                            |
| Hours tool  | Hours tracker — **shipped** 2026-09-23: the week view at `/hours` with its aside, the summary at `/hours/summary`, the settings at `/hours/settings`, CSV and `pnpm data:export` ([feature doc](features/hours-tracker.md))     |

Not built: passkeys, backups, the command palette.

## Roadmap

Scheduled work, updated in the PR that starts or finishes an item. Sizes: S
(one PR), M (a few PRs), L (a feature doc and several slices). Unscheduled
candidates are in [BACKLOG.md](BACKLOG.md).

### Now

- Nothing in progress. The hours tracker (the first tool, on ADR-0020's
  modular-tools structure) shipped on 2026-09-23 and is in the feature
  inventory; the owner picks the next item from Next.

### Next

- `M` Backups: nightly dump, encrypted off-site copy, restore drill, data export.
- `L` Login hardening — passkeys, session policy, brute-force posture; required
  before the first public deployment.
- `S` App shell: router pending and error states (UX_STANDARDS.md → Timing).
  The rest of the item — density tokens, the layout, z-index and motion
  tokens, the three-way theme — shipped with the
  [app shell refresh](features/app-shell-refresh.md) on 2026-09-24.
- `M` CI: Docker image build, Firefox e2e at 1280×800 and 1920×1080, multi-arch
  (amd64 + arm64) images.

### Later

- `M` Command palette (Ctrl/Cmd+K).
- `S` Error-code catalogue for API errors.
