# Hours tracker

- **Status:** Draft
- **Change class:** Feature, built on
  [ADR-0020](../adr/0020-modular-tools-over-shared-core-data.md) (Architectural,
  Proposed). Escalation triggers: database migrations, ownership code, new
  runtime dependencies (`date-fns`, `@date-fns/tz`), and a new workspace package.
- **Tool id:** `hours` · **Sidebar label:** Hours · **Web root:** `/hours`

## Problem & outcome

The owner works in construction management and Home Office construction
engineering, and has no single record of hours worked. Start and finish times,
breaks, extra hours and time off in lieu (TOIL) are worked out by hand, if at
all.

When this ships the owner can:

- type start and end times into a dense week view, keyboard first;
- see worked time against contracted time for each day, week and period, with
  overtime, flexi and TOIL balances kept up to date;
- record leave and bank holidays so they count correctly;
- review period summaries and export the data.

The rules follow the owner's own terms of employment, which the owner will set
out ([questions](#decisions--open-questions)). Nothing here assumes those terms
are known.

## Glossary

Use these terms in code, UI copy and docs (they move to PRODUCT.md's glossary
when the doc is approved).

| Term                | Meaning                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Time entry**      | One continuous span of work: a start instant, an end instant and break minutes, plus a kind and a note. |
| **Work date**       | The `Europe/London` calendar date a time entry counts towards: the local date of its start.             |
| **Worked time**     | Elapsed minutes from start to end, minus break minutes, summed per day.                                 |
| **Work pattern**    | The contracted minutes for each weekday and the rules below, effective from a date.                     |
| **Contracted time** | The minutes the pattern expects on a date; zero on non-working days and public holidays.                |
| **Absence**         | Leave on a date (annual, sick, TOIL taken, other). It covers contracted time, fully or in part.         |
| **Variance**        | Worked time plus absence cover, minus contracted time, for a day, week or period.                       |
| **Overtime**        | Time the owner marks as authorised overtime, either paid or converted to TOIL.                          |
| **Flexi balance**   | The running total of variance from normal time, carried between periods.                                |
| **TOIL balance**    | TOIL earned from overtime, minus TOIL taken.                                                            |
| **Period**          | The accounting period used for summaries and carry-over (calendar month or four weeks).                 |
| **Time adjustment** | A signed, dated correction to a balance: an opening balance, a forfeit, overtime paid out.              |

## Acceptance criteria

- [ ] The sidebar shows **Hours**. It opens `/hours` on the current week in
      `Europe/London`, and `?week=YYYY-MM-DD` (that week's Monday) is reflected
      in the URL, so reload, back/forward and bookmarks restore the week.
- [ ] The owner can add, edit and delete time entries for any day of the shown
      week using only the keyboard. Times are typed as `0830`, `830`, `8:30` or
      `08.30`, and end-before-start is shown as past midnight.
- [ ] Each day shows worked, contracted and variance as `h:mm`, and the week
      shows totals for worked vs contracted, overtime, flexi balance and TOIL
      balance. A sign and a label show direction, not colour alone.
- [ ] The totals update while the owner types, before saving, and match the
      totals the API returns after saving.
- [ ] Deleting an entry or an absence removes it at once, shows
      "Time entry deleted · Undo" for 8 seconds and moves focus to the next row.
      Undo restores it.
- [ ] Overlapping entries on the owner's timeline are refused with an inline
      message (API 409), including when undo would restore an overlap.
- [ ] Calculations are correct across day, week and period boundaries, and on
      the BST start and end dates. Each rule in
      [Calculation rules](#calculation-rules) has a unit test.
- [ ] Work patterns are effective-dated. Changing the pattern from a date never
      changes results for earlier dates.
- [ ] An opening flexi or TOIL balance can be entered on the tracking start date.
- [ ] Leave and bank holidays (England and Wales, built in) reduce or cover
      contracted time as the approved rules say.
- [ ] `/hours/summary` shows totals grouped by week or period for a range held in
      the URL, with This period, Last period, This year and a custom range.
- [ ] The owner can download the shown range as CSV. A server CLI command exports
      every owned table to JSON.
- [ ] Every screen has loading, empty, error and success states. Every screen
      passes axe, works at 1280×800 and 1920×1080, and reflows at 400% zoom.
- [ ] Another owner's rows return 404 on every endpoint (ADR-0016).

## Design

### Calculation rules

The engine is pure TypeScript in `@repo/domain`
(`packages/domain/src/hours/`), with no I/O and no "now": callers pass every
date. Both apps run the same code (ADR-0020 §5). All arithmetic is in **integer
minutes**, and display formatting is separate.

Defaults marked **(A)** are assumptions. They depend on the owner's answers
below and are built as pattern settings, so a different answer is data, not a
redesign.

1. **Entry time** = `endsAt − startsAt` in real elapsed minutes, minus
   `breakMinutes`. It is computed on instants, so a night that crosses a clock
   change is an hour shorter (March) or longer (October). A local-wall-clock
   subtraction would get this wrong.
2. **Work date** = the `Europe/London` date of `startsAt`. An entry that runs
   past midnight counts wholly to the day it started **(A)**.
3. **Day contracted** = the pattern minutes for that weekday, using the pattern
   with the latest `effectiveFrom` ≤ the date. It is 0 on a public holiday
   **(A: bank holidays are paid days off)**, and 0 before the tracking start
   date.
4. **Break rule (A):** when a day's worked time exceeds 6 hours and its total
   recorded break is under 30 minutes, the shortfall is deducted once for the
   day. This is a pattern setting (`minBreakMinutes`, `minBreakAfterMinutes`),
   and zero turns it off.
5. **Absence cover:** a full-day absence covers the day's contracted time. A
   part-day absence covers its minutes, capped at contracted. A `TOIL` absence
   also debits the TOIL balance by the minutes it covers.
6. **Day variance** = worked (normal kind) + absence cover − contracted. A
   past working day with nothing recorded has variance −contracted and shows a
   "No time recorded" marker **(A)**. Days after the `asOf` date are not
   counted.
7. **Overtime (A):** only entries marked `OVERTIME` are overtime. Their minutes
   never enter the flexi variance. With treatment `TOIL` they add
   `minutes × toilMultiplier` (default 1.0) to the TOIL balance. With `PAID`
   they are totalled as paid overtime hours, with no money calculated.
8. **Week** = Monday to Sunday (ISO) in `Europe/London`. The week totals are the
   sum of its days, and weeks may straddle periods.
9. **Period (A: calendar month)** is set by the pattern (`CALENDAR_MONTH`, or
   `FOUR_WEEKS` from an anchor date). The flexi balance at the end of a period is
   the opening balance, plus the period's variance, plus adjustments dated in it.
10. **Caps (A: warn only):** a period that ends above the credit cap or below
    the debit cap is flagged. Nothing is forfeited automatically; the owner can
    confirm a forfeit, which creates a time adjustment.
11. **Balances as of a date** = the sum of all days and adjustments from the
    tracking start to that date. At personal scale (hundreds of rows a year)
    this is computed on read. A stored period snapshot is added only if a
    measurement shows the need (PERFORMANCE.md).
12. **TOIL (A):** no expiry, and it can go negative only with a warning.
13. **Display:** durations as `h:mm` (`7:24`), variance signed (`+0:36`,
    `−1:12`) plus a word ("over", "under"), and decimal hours only in CSV.

**Unit test matrix** (Vitest, a fixed date per test, no wall clock):

- a single entry; several entries; a break equal to or longer than the span
  (invalid); a zero-length entry (invalid); an entry over 24 hours (invalid);
- an entry past midnight counts to its start date, including across a week and
  a period boundary (Sunday → Monday, 31st → 1st);
- **BST starts** Sunday 29 March 2026: 00:30–03:30 local is 2:00 worked.
  **BST ends** Sunday 25 October 2026: 00:30–03:30 local is 4:00 worked. Repeat
  for 28 March and 31 October 2027. Week totals for both weeks;
- the break rule on and off; exactly 6:00 and 6:01 worked; breaks spread across
  several entries;
- a pattern change mid-week and mid-period (earlier days use the old pattern);
- a public holiday on a working day, on a non-working day, and worked anyway;
- full and part-day absences; an absence exceeding contracted time; TOIL taken
  debiting the balance;
- overtime as TOIL at 1.0 and at 1.5; paid overtime kept out of both balances;
- four-week periods from an anchor date, including a range starting mid-period;
- caps: exactly at a cap, one minute over, a confirmed forfeit;
- balances with an opening adjustment, and `asOf` in the middle of a week;
- the time parser (`0830`, `830`, `8:30`, `08.30`, `24:00`, `25:00` invalid,
  `7` → 07:00) and the formatter (negative values, over 24 hours).

### Data model

Standard columns on every table (UUID v7 `id`, `owner_id`, `created_at`,
`updated_at`, `deleted_at`, `version`), per [DATABASE.md](../DATABASE.md). Every
duration is `Int` minutes. **Run database-architect before each migration.**
Columns marked _(Q n)_ exist only if the answer to question _n_ needs them.

**Core** (`modules/core/`, ADR-0020 §2):

- **`public_holidays`** (`PublicHoliday`): `date date`, `name text`.
  - Unique active: `uq_public_holidays_owner_id_date_active` (partial index).
  - Rows come from a bundled England and Wales list for the years the owner
    imports. There is no runtime network call.

**Tool-owned** (`modules/hours/`):

- **`work_patterns`** (`WorkPattern`), an effective-dated contract:
  - `effective_from date`, with a partial unique index on
    `(owner_id, effective_from)` for active rows;
  - `mon_minutes` … `sun_minutes int`, `CHECK` 0–1440;
  - `min_break_minutes int`, `min_break_after_minutes int` _(Q4)_;
  - `period_kind` enum `CALENDAR_MONTH | FOUR_WEEKS`, and
    `period_anchor date NULL` (`CHECK` present when `FOUR_WEEKS`) _(Q5)_;
  - `flexi_credit_cap_minutes int NULL`, `flexi_debit_cap_minutes int NULL`
    _(Q6)_;
  - `toil_multiplier Decimal(4,2) default 1.00` _(Q3)_;
  - `band_start time(0) NULL`, `band_end time(0) NULL` _(Q8)_. `time` is not in
    DATABASE.md's type table yet; database-architect to confirm and add it.
  - The earliest active `effective_from` is the **tracking start date**.
- **`time_entries`** (`TimeEntry`):
  - `work_date date`, set by the service from `starts_at` (rule 2), never
    accepted from the client;
  - `starts_at timestamptz(3)`, `ends_at timestamptz(3)`;
  - `ck_time_entries_ends_after_starts`, and
    `ck_time_entries_max_24h` (`ends_at - starts_at <= interval '24 hours'`);
  - `break_minutes int default 0`, `CHECK >= 0`;
  - `kind` enum `NORMAL | OVERTIME`;
  - `overtime_treatment` enum `TOIL | PAID NULL`, with a `CHECK` that it is set
    only when `kind = OVERTIME` _(Q2, Q3)_;
  - `activity` enum _(Q10: `OFFICE | HOME | SITE | TRAVEL | OTHER`)_ and
    `note text NULL`;
  - **no overlaps:**
    `EXCLUDE USING gist (owner_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (deleted_at IS NULL)`.
    This needs `CREATE EXTENSION IF NOT EXISTS btree_gist` (a trusted extension
    in PostgreSQL 17). Prisma cannot express it, so it is written in the
    migration SQL, and later migrations must be checked so they do not drop it;
  - index `@@index([ownerId, workDate])` for range reads. The exclusion index
    serves overlap checks.
- **`absences`** (`Absence`):
  - `date date`;
  - `kind` enum `ANNUAL_LEAVE | SICK | TOIL | SPECIAL | OTHER` _(Q7)_;
  - `minutes int NULL` (null = full day), `CHECK` null or > 0;
  - `note text NULL`;
  - `@@index([ownerId, date])`. Multiple absences on a date are allowed; the
    service caps their cover at contracted time.
  - A name that does not mention the tool, so it can move to core if a leave
    planner tool needs it (ADR-0020 §2).
- **`time_adjustments`** (`TimeAdjustment`):
  - `effective_date date`;
  - `balance` enum `FLEXI | TOIL`;
  - `minutes int` (signed, `CHECK <> 0`);
  - `reason` enum `OPENING_BALANCE | FORFEIT | PAID_OUT | CORRECTION`;
  - `note text NULL`;
  - `@@index([ownerId, effectiveDate])`.

Nothing derived is stored: no daily totals and no balance columns.

**Migrations:** four additive migrations, one per data slice (slices 4, 5 and 11,
which has two tables in two migrations). The time entries migration creates
`btree_gist`. There are no destructive changes, but a `pg_dump` is still
taken before each deploy (DATABASE.md → Migration safety).

### API

All endpoints are under `/api/v1`, authenticated, with OpenAPI tag `Hours` (or
`Core`), and generated with `pnpm gen:feature <entity> --tool hours` (or
`--core`), then adapted. Ids use `ParseUuidPipe`. Instants are ISO with `Z`,
dates `YYYY-MM-DD`, and durations are integer `…Minutes` fields.
`pnpm contract:generate` runs in every API slice. All changes are additive, so
there is no breaking contract change.

| Method and path                                         | Purpose                                                                                                                                                                                            | Status codes                                        |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `GET /time-entries?from&to&limit&cursor`                | Entries whose `workDate` is in `[from, to)`, sorted `startsAt` asc, then `id`                                                                                                                      | 200, 400, 401, 422                                  |
| `POST /time-entries`                                    | `{ startsAt, endsAt, breakMinutes, kind, overtimeTreatment?, activity?, note? }`                                                                                                                   | 201, 401, 409 (overlap), 422                        |
| `GET/PATCH/DELETE /time-entries/:id`                    | Read, update with `version`, soft delete                                                                                                                                                           | 200/204, 400, 401, 404, 409, 422                    |
| `POST /time-entries/:id/restore`                        | Undo a delete                                                                                                                                                                                      | 200, 400, 401, 404, 409                             |
| `GET/POST /absences`, `…/:id`, `…/:id/restore`          | The same shape; list by `from`/`to` on `date`                                                                                                                                                      | as above                                            |
| `GET/POST /work-patterns`, `GET/PATCH/DELETE …/:id`     | Effective-dated patterns; delete refused (422) for the last remaining one                                                                                                                          | as above                                            |
| `GET/POST /time-adjustments`, `…/:id`, `…/:id/restore`  | Opening balances, forfeits, corrections                                                                                                                                                            | as above                                            |
| `GET /time-summaries?from&to&groupBy=day\|week\|period` | Computed groups: `{ start, end, contractedMinutes, workedMinutes, absenceMinutes, varianceMinutes, overtimePaidMinutes, toilEarnedMinutes, toilTakenMinutes, flexiBalanceEndMinutes, capWarning }` | 200, 401, 422 (range over 366 days, `to` ≤ `from`)  |
| `GET /time-balances?asOf`                               | `[{ balance: FLEXI\|TOIL, minutes }]` as of the end of `asOf`                                                                                                                                      | 200, 401, 422                                       |
| `GET/POST /public-holidays`, `…/:id`, `…/:id/restore`   | Core list by range, manual add, delete                                                                                                                                                             | as above                                            |
| `POST /public-holiday-imports`                          | `{ year }`: adds the missing bundled England and Wales dates for that year                                                                                                                         | 200 (nothing new), 201, 401, 422 (year not bundled) |

- Ownership is enforced in the service on every read, update, delete and
  restore. Another owner's id gets the same 404.
- **Overlap:** the service checks for an overlap inside the create, update or
  restore transaction, and returns 409. The exclusion constraint is the
  backstop. Map PostgreSQL `23P01` to 409 in `AllExceptionsFilter` (unmapped
  today; it would be a 500).
- `time-summaries` and `time-balances` are computed read-models, bounded by
  range (ADR-0020 §4). The service loads the patterns, entries, absences,
  adjustments and holidays it needs with bounded, owner-scoped range queries,
  with no N+1, and calls `@repo/domain`. Neither reads "now", so no `Clock` seam
  is needed. The web passes today's `Europe/London` date.
- Limits in `@repo/types`: note ≤ 500 characters; break ≤ 1440 minutes; list
  `limit` ≤ 100 today, and the week view pages with the cursor if a week ever
  exceeds it.

### UI

Desktop, at least 1280px wide, compact density (14px text, 32px rows), per
[UX_STANDARDS.md](../UX_STANDARDS.md). Composed from shared primitives only;
new primitives are built in `components/ui/` to DESIGN_SYSTEM.md's planned
specs.

**Sidebar:** the Hours entry (Lucide `Clock`), from `features/hours/tool.ts`
through `app/tools.ts`. It is `aria-current="page"` on every `/hours/*` route,
and has a tooltip and accessible name in the rail state.

**Routes and URL state:**

| Route             | Search params (Zod-validated)                                         | Content                                   |
| ----------------- | --------------------------------------------------------------------- | ----------------------------------------- |
| `/hours`          | `week` (a Monday; other dates are normalised with a replace redirect) | Week view (the tool's home)               |
| `/hours/summary`  | `from`, `to`, `groupBy=week\|period`                                  | Period summaries                          |
| `/hours/settings` | `tab=pattern\|balances\|holidays`                                     | Work patterns, opening balances, holidays |

**Week view** (`/hours`):

```text
┌ Hours ─────────────────────────── ‹ Week of 14 Sep 2026 › [This week] [Add time]┐
│ Day / entry     Start  End    Break  Kind      Activity  Note          Worked  ⋯ │ ┌ This week ────────┐
│ Mon 14 Sep                              contracted 7:24 · worked 8:00 · +0:36   │ │ Worked   30:10    │
│   ├ entry       07:45  12:15  0:00   Normal    Site      Hangar survey   4:30  ⋯ │ │ Contract 29:36    │
│   ├ entry       12:45  16:15  0:30   Normal    Office                    3:00  ⋯ │ │ Variance +0:34 over│
│   └ + Add time                                                                  │ │ Overtime  1:00 TOIL│
│ Tue 15 Sep  Annual leave (full day)     contracted 7:24 · covered · 0:00        │ ├ Balances (to today)┤
│ Wed 16 Sep  (today)  No time recorded                                           │ │ Flexi   +3:12     │
│ …                                                                               │ │ TOIL     4:30     │
└─────────────────────────────────────────────────────────────────────────────────┘ └───────────────────┘
```

- **Layout:** a page header (one `<h1>` "Hours", the week navigator, one primary
  action "Add time" that focuses today's new-entry row). Then a CSS grid: the
  full-bleed entry table, and a fixed-width totals aside that stacks below the
  table when the reflow floor is reached. Not a list/detail split: there is no
  detail to open.
- **Table:** a real `<table>` with day header rows (`<th scope="rowgroup">`:
  date, contracted, worked, variance, and a leave or holiday badge) and one row
  per entry. It has no `role="grid"`, because cells hold ordinary inputs and Tab
  order is the keyboard model. Numeric columns are right-aligned with tabular
  numerals.
- **Entry rows are small forms.** Tab moves Start → End → Break → Kind →
  Activity → Note → row menu. **Enter saves the row** (a single-line form
  submit); **Esc reverts** it. A changed row shows "Unsaved" and a Save button,
  and the view blocks navigation with unsaved rows (UX_STANDARDS.md → Forms).
  Validation runs on blur and save, and errors show inline under the field. Each
  day ends with a "+ Add time" row, so an empty week is typed into, not clicked
  through.
- **`TimeInput`** (a new primitive): a text input with a `24-hour, e.g. 08:30`
  hint linked by `aria-describedby`. It parses on blur and shows `08:30`. An end
  earlier than the start shows a visible "+1 day" tag, which the screen reader
  also announces. A native `type="time"` is not used, because it behaves
  differently in Chromium and Firefox and is awkward from the keyboard.
- **Live totals:** the day and week figures are computed in the browser with
  `@repo/domain` from the saved entries plus unsaved rows, and re-read from
  `time-summaries` and `time-balances` after each save. Totals changes are not
  announced on every keystroke; the aside has a polite live region that updates
  after a save.
- **Row menu (⋯)**, mirrored by a right-click context menu: Mark as overtime
  (TOIL or paid), Duplicate to next day, Delete time entry. On a day header:
  Record leave, Mark as worked holiday. There are no single-key shortcuts.
- **Delete:** an optimistic removal with an 8-second undo toast
  (FRONTEND_ARCHITECTURE.md → Optimistic updates and undo). Undo calls
  `…/restore`; focus moves to the next row.
- **States:**
  - loading: skeleton day rows at the final height (after 300ms);
  - no work pattern yet: an empty state, "Set your working pattern to start
    tracking hours", with a link to settings;
  - empty week: day rows with "+ Add time", plus a one-line "No time recorded
    this week";
  - error: an inline table error with Retry that keeps the header;
  - partial: entries loaded but totals failed, so an inline error with Retry in
    the aside only;
  - a save failure: a persistent error toast, and the row keeps the owner's
    input.

**Summary** (`/hours/summary`): a page header with range presets (This period,
Last period, This year, Custom from and to) and "Download CSV" as the primary
action. A table has one row per week or period: contracted, worked, absence,
variance, overtime paid, TOIL earned, TOIL taken, and flexi balance at the end.
A totals row, and a cap-warning badge (icon + text). The empty range state reads
"No time recorded between these dates". Error and loading follow the table
rules.

**Settings** (`/hours/settings`, tabs in the URL):

- Pattern: an explicit-save form for a new pattern, with its effective date. It
  lists earlier patterns read-only, with delete and undo.
- Balances: opening flexi and TOIL balances, and adjustments.
- Holidays: a list by year, "Add bank holidays for <year>", a manual add, and
  delete with undo.

**Command palette** (declared in the manifest; available once the palette is
built, which is not part of this feature, see Dependencies):

- Go to Hours
- Hours: add time today
- Hours: go to this week
- Hours: open summary
- Hours: download this period as CSV
- Hours: open settings

### Export

Backups are not built yet (PRODUCT.md → Next), so the owner's first real data
needs a way out:

- **CSV:** client-side from `time-entries` and `time-summaries` for the shown
  range. One file of entries (date, start, end, break, worked in `h:mm` and
  decimal hours, kind, activity, note), and one of summary rows. Built with a
  unit-tested CSV builder (quoting, a formula-injection guard on note text
  starting with `=`, `+`, `-` or `@`).
- **Full JSON:** `pnpm data:export`, the server CLI command DATABASE.md plans.
  It follows the `cli/` pattern (ADR-0018) and writes every owned domain table.
  It is the owner's route off the platform and a stopgap until the backups exist.

### Dependencies and reuse

- **Reused:** the reference template and generator (ADR-0015); `AllExceptionsFilter`
  and the envelopes; `ParseUuidPipe`; `@CurrentUser()`; `apiClient`/TanStack
  Query; the `Form`, `Input`, `Button`, `Alert` primitives; the `cli/` bootstrap.
- **Built here because hours is the first to need them** (to their existing
  specs): the sidebar and tool registry, `lib/preferences.ts`, Tooltip, Toast
  (with undo), DropdownMenu/ContextMenu, Skeleton, Tabs, `TimeInput`; the
  template's restore endpoint and transaction-capable repositories (both in
  BACKLOG.md); the generator's `--tool`/`--core` flags; `packages/domain`.
- **Not built here:** the command palette (PRODUCT.md → Later; the commands
  above are declared ready for it); the full app-shell item's density, motion
  and z-index token retune (PRODUCT.md → Next; slice 1 takes only the sidebar
  and the content width); `DataTable` (a plain semantic table is enough at a
  week's size).
- **Deployment:** building does not wait for login hardening or backups, but
  WorkHub stays off the internet until they exist (DECISIONS.md, 2026-09-16).

## Slices

Each slice is one PR that leaves `main` releasable. Slices 1–2 wait for ADR-0020's
approval; slices 3 onwards also wait for the owner's answers below.

1. **Tool registry and sidebar**: `ToolManifest`, `app/tools.ts` (Home only
   for now), the sidebar (expanded or rail, persisted through
   `lib/preferences.ts`, applied before first paint), Tooltip, and the content
   width from the layout tokens. Tests: component tests (rail labels, tooltip,
   `aria-current`); a Playwright journey with axe at 1280 and 1920, and the rail
   at 400% zoom.
2. **Template and generator groundwork**: the restore endpoint and optional
   `db` transaction client in the reference template; `gen:feature --tool` and
   `--core`, with `verify-template.sh` covering `--tool`; `23P01` → 409 in the
   filter; the ADR-0020 doc updates (BACKEND_ARCHITECTURE, REFERENCE_FEATURE,
   FRONTEND_ARCHITECTURE, API.md). Tests: the template's e2e for restore; a
   filter unit test; CI template verification.
3. **Calculation engine**: `packages/domain` (Turborepo wiring, lint, Vitest),
   `core/time` (`Europe/London` helpers on `@date-fns/tz`), `hours/` rules, the
   time parser and formatter. Tests: the full [unit matrix](#calculation-rules).
   Reviews: security-reviewer (new dependencies).
4. **Work patterns and time adjustments API**, with the first migration. Tests: API e2e for each
   status code, ownership 404, 409 version conflict, 422 on the last pattern and
   bad caps. Reviews: database-architect first.
5. **Time entries API**, with the exclusion constraint (this migration creates
   `btree_gist`). Tests: API e2e covering
   CRUD, restore, overlap 409 (create, update and restore), 422 rules,
   BST-boundary instants stored and listed on the right `workDate`, range
   pagination, and ownership 404.
6. **Settings: pattern and opening balances UI**: the settings route and tabs,
   the pattern form, the balances form; the Tabs, Toast and DropdownMenu
   primitives. Tests: component tests for the forms; Playwright + axe for set
   pattern, change pattern and undo delete.
7. **Week view entry**: the `/hours` route with `?week`, `TimeInput`, row forms,
   the Hours manifest in the sidebar, delete and undo, and all states;
   client-side day totals. Tests: `TimeInput` component tests; a keyboard-only
   Playwright journey (add, edit and delete a week of entries, undo, past
   midnight) with axe at 1280 and 400% zoom.
8. **Export**: the CSV download of entries for the shown week and range;
   `pnpm data:export` JSON. Tests: CSV builder unit tests (escaping, injection
   guard, decimal hours); a CLI test against the `_test` database. Reviews:
   security-reviewer (data leaving the system).
9. **Summaries and balances API**: `time-summaries` and `time-balances` on
   `@repo/domain`. Tests: API e2e for range validation 422, week and period
   grouping, a BST week, balances with adjustments and patterns, and ownership
   (another owner's rows never counted).
10. **Totals aside and summary view**: the week aside (week totals, balances to
    today), `/hours/summary` with URL range and grouping, cap warnings, and
    summary CSV. Tests: Playwright + axe; a check that browser totals equal API
    totals for a seeded week.
11. **Leave and public holidays**: the core `public-holidays` with the bundled
    England and Wales data and the import endpoint; `absences` API; Record leave
    in the week view; the Holidays settings tab. Tests: API e2e for both
    resources, including import idempotency; Playwright + axe for recording
    leave and a bank holiday week.

When slice 11 lands: Status → Shipped, update PRODUCT.md's purpose, glossary and
feature inventory, and write the as-built notes.

## Decisions & open questions

Every default below is an **assumption to confirm**. Where UK Civil Service or
Home Office practice informed a default, that is noted, but none of it is taken
as the owner's actual terms. Record each answer and its date here.

### Employment rules: hours and extra time

1. **Contracted hours and working pattern.** Default **(assumption)**: a weekly
   pattern whose hours can differ by weekday, starting from 37 hours Mon–Fri at
   7:24 a day, excluding lunch (a common Civil Service full-time figure). The
   exact numbers are settings. Only the pattern shape changes the design:
   _weekly by weekday_ (default), a _two-week cycle_ (for example a 9-day
   fortnight: 14 day columns and a cycle anchor), or _annualised hours_ (an
   annual target instead of daily contracted time).
2. **What happens to time over or under contract.** Default **(assumption)**: it
   goes to a **flexi balance** carried between periods, and time counts as
   overtime only when the owner marks an entry. This matches a typical Civil
   Service flexi scheme, where overtime must be authorised. Alternatives: all
   excess becomes TOIL automatically; all excess is paid overtime and there is no
   balance; no balance at all, just the difference.
3. **Overtime: TOIL rate and pay.** Default **(assumption)**: marked overtime is
   either TOIL at 1:1, or paid overtime recorded as hours only, with no £
   calculation. Alternatives: enhanced rates (for example time and a half on
   weekdays, double on Sundays and bank holidays), which need a rate per day
   type; or calculating overtime pay in integer pence from an hourly rate, which
   adds pence columns and a rate history.
4. **Breaks.** Default **(assumption)**: the owner records actual breaks, and a
   minimum of 30 minutes is deducted on days over 6 hours worked. That is
   informed by the Working Time Regulations' 20-minute rest after 6 hours and
   common flexi-scheme lunch rules. Alternatives: a fixed unpaid lunch every
   working day; actual breaks only; paid breaks, never deducted.

### Employment rules: periods, balances and leave

5. **Reporting and accounting period.** Default **(assumption)**: a calendar
   month. Alternatives: four-week periods from an anchor date (common in flexi
   schemes); weekly only, with a running balance.
6. **Caps and carry-over.** Default **(assumption)**: carry the flexi balance
   forward with credit and debit caps the owner sets, warn when a period ends
   outside them, and forfeit only when the owner confirms. Alternatives:
   automatic forfeit at period end; no caps.
7. **Leave and bank holidays.** Default **(assumption)**: leave (annual, sick,
   TOIL, special, other; full or part day) covers contracted time; the England
   and Wales bank holidays are built in as paid days off; no annual leave
   allowance tracking in this feature. Alternatives: also track a leave-year
   allowance and remaining days, including any Civil Service privilege day if
   the owner's terms still have one (a leave-year setting, allowance history and
   a leave summary); or leave is out of scope and days are zeroed by hand.
8. **Working band or core hours.** Default **(assumption)**: no band. All
   recorded time counts, which suits early site starts. Alternatives: warn when
   time falls outside a band (for example 07:00–19:00) or core hours are missed;
   count only time inside the band unless it is marked overtime.

### Recording and structure

9. **How time is recorded.** Default: several start–end entries per day, entered
   after the fact, and an entry may run past midnight. Alternatives: one start,
   end and break per day (simpler, no overlap constraint); entries plus a live
   clock in and clock out for today (nullable `ends_at` and one open entry).
10. **Activity and shared records.** Default: an activity type (Office, Home,
    Site, Travel, Other) plus a note, with every type counting as worked time
    **(assumption: travel counts as work)**. Alternatives: travel recorded but
    not counted; a note only; link entries to a shared core Projects and sites
    list now (a core entity and picker, a bigger first release).
11. **Tool architecture (ADR-0020).** Default: approve it as drafted, with flat
    `/api/v1` resources, tool folders and a shared core. Alternatives: namespace
    APIs and tables by tool; no tool concept until a second tool exists.
12. **Where the calculation engine runs.** Default: a shared `@repo/domain`
    package that both apps run, on `date-fns` + `@date-fns/tz`. That gives live
    totals while typing and one tested rule set. Alternatives: the API only, with
    the web showing totals after each save; the shared package on the Temporal
    polyfill instead of `date-fns`.

### Stated defaults (not asked; change on request)

- Weeks run Monday to Sunday. Durations are exact to the minute with no
  rounding, and shown as `h:mm`.
- An unrecorded past working day counts as zero worked and is flagged.
- The tracking start date is the first pattern's effective date. The opening
  balances are entered on that date.
- TOIL does not expire. England and Wales holidays only.
- Data export is CSV from the UI and JSON from the CLI. No import from other
  tools in this feature.

## As-built notes

None yet.
