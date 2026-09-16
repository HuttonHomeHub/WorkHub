# Hours tracker

- **Status:** Draft. The owner answered the design questions on 2026-09-16
  ([decisions](#decisions--open-questions)); final approval is pending.
- **Change class:** Feature, built on
  [ADR-0020](../adr/0020-modular-tools-over-shared-core-data.md) (Architectural,
  Proposed; the owner approved it as drafted). Escalation triggers: database
  migrations, ownership code, a new runtime dependency (`temporal-polyfill`),
  and a new workspace package (`@repo/domain`).
- **Tool id:** `hours` · **Sidebar label:** Hours · **Web root:** `/hours`

## Problem & outcome

The owner works in construction management and Home Office construction
engineering, and has no single record of hours worked. Start and finish times,
breaks, flexi, time off in lieu (TOIL), overtime and leave are worked out by
hand.

When this ships the owner can:

- type one start, end and break for each day into a dense week view, keyboard
  first;
- see each week's hours against the 37.5-hour contract, with a flexi balance
  that can go negative;
- mark part of a week's extra time as TOIL or overtime. The tool spreads it
  across the days, applies the monthly TOIL cap, and converts unused TOIL at
  month end;
- record leave in hours and see the leave allowance remaining for the year,
  with bank holidays deducted;
- get warnings for short days, time outside the working band, and caps;
- review weekly and monthly summaries, and export the data.

## Glossary

Use these terms in code, UI copy and docs (they move to PRODUCT.md's glossary
on approval). Every duration is whole minutes.

| Term                 | Meaning                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Work day**         | One row for a date: an optional start and end, break, leave, TOIL taken, and whether a bank holiday was worked.                                                  |
| **Worked time**      | The span from start to end, minus the deducted break (rule 2).                                                                                                   |
| **Credited time**    | Worked time + leave + TOIL taken + bank holiday credit.                                                                                                          |
| **Work terms**       | Effective-dated settings: weekly contracted hours, working days and their minimums, break rule, working band, overtime eligibility, caps, maximum leave per day. |
| **Daily minimum**    | The least credited time expected on a working day (7:30 Mon–Thu, 5:30 Fri). It raises a warning only.                                                            |
| **Week excess**      | A week's credited time minus weekly contracted time, when positive.                                                                                              |
| **Extra time claim** | The owner marking part of a week's excess as TOIL and/or overtime.                                                                                               |
| **Flexi balance**    | The running total of weekly variance that is not claimed. It can go negative.                                                                                    |
| **TOIL**             | Claimed time to be taken as time off in the same calendar month; at most 7:30 a month.                                                                           |
| **Overtime**         | Claimed or converted time: **paid** when the owner is eligible and it is approved, otherwise **unpaid**. Recorded in hours only.                                 |
| **Leave year**       | 1 January to 31 December, with an allowance in hours (247:30, plus 37:30 bought leave when chosen).                                                              |
| **Time adjustment**  | A signed, dated correction: an opening balance, a confirmed flexi forfeit, a correction.                                                                         |

## Acceptance criteria

- [ ] The sidebar shows **Hours**. It opens `/hours` on the current week in
      `Europe/London`, and `?week=YYYY-MM-DD` (that week's Monday) is in the
      URL, so reload, back/forward and bookmarks restore the week.
- [ ] The owner can enter, edit and clear one start, end and break per day, plus
      leave and TOIL taken, using only the keyboard. Times are typed as `0830`,
      `830`, `8:30` or `08.30`, and an end before the start is shown as past
      midnight.
- [ ] Each day shows worked and credited time as `h:mm`. The week shows credited
      vs 37:30, variance, flexi balance, TOIL this month, overtime (paid and
      unpaid) and leave remaining. A sign and a word show direction, not colour
      alone.
- [ ] Totals update while the owner types, before saving, and match what the API
      returns after saving.
- [ ] Warnings (not errors) appear for:
  - a working day below its minimum;
  - time outside the working band;
  - a flexi cap crossed;
  - TOIL over the monthly cap, or unused at month end;
  - leave over the allowance;
  - a claim larger than the week's excess.
- [ ] The owner can claim part of a week's excess as TOIL and/or overtime. It is
      spread across days by the [allocation rule](#rule-7-allocating-a-claim-to-days),
      and the rest stays in flexi.
- [ ] TOIL above 7:30 in a calendar month, and TOIL unused at month end, become
      overtime: paid when eligible and approved, unpaid otherwise.
- [ ] Leave is recorded in hours (more than 0, at most 7:30 a day). Bank holidays
      are deducted from the 247:30 allowance, and bought leave adds 37:30 for a
      year.
- [ ] Clearing a day or deleting a claim removes it at once and shows an 8-second
      undo toast. Undo restores it.
- [ ] Work terms are effective-dated from a Monday. A change never alters results
      for earlier weeks.
- [ ] Calculations are correct across week and month boundaries and on the BST
      start and end dates. Each rule has unit tests.
- [ ] `/hours/summary` shows totals by week or month for a range held in the URL.
- [ ] The owner can download the shown range as CSV. `pnpm data:export` writes
      every owned table to JSON.
- [ ] Every screen has loading, empty, error and success states. Every screen
      passes axe, works at 1280×800 and 1920×1080, and reflows at 400% zoom.
- [ ] Another owner's rows return 404 on every endpoint (ADR-0016).

## Design

### Calculation rules

The engine is pure TypeScript in `@repo/domain` (`packages/domain/src/hours/`).
It does no I/O and never reads "now": callers pass every date, including
`asOf`. Both apps run the same code (ADR-0020 §5). Dates and zones use
**Temporal** (`Temporal.PlainDate`, `Temporal.ZonedDateTime` in
`Europe/London`) through `temporal-polyfill`. All arithmetic is in **integer
minutes**. Rules marked **(Q n)** wait for open question _n_ in the
[decisions](#decisions--open-questions).

1. **Weeks** run Monday to Sunday in `Europe/London`. Work terms apply from
   their `effectiveFrom` Monday, and each week uses the terms in force on its
   Monday.
2. **Worked time** = elapsed minutes from `startsAt` to `endsAt`, computed on
   instants, minus the deducted break.
   - If the elapsed span is over the break threshold (default 6:00), the
     deducted break is the recorded break or the break minimum (default 0:30),
     whichever is larger.
   - Otherwise the deducted break is the recorded break.
   - The span is used, not worked time, so the rule cannot loop. A span of 6:01
     with no break is 5:31 worked.
   - A night across a clock change is an hour shorter (March) or longer
     (October).
3. **Bank holiday credit:** a working weekday that is a public holiday gets
   credit equal to the maximum leave per day (7:30). It is also deducted from
   the leave allowance. If `bankHolidayWorked` is set, there is no credit and no
   deduction, and the day counts as normal time.
4. **Credited time** for a day = worked + leave + TOIL taken + bank holiday
   credit. Leave and TOIL taken are more than 0 and at most the maximum leave
   per day (7:30) each, and only on working days.
5. **Week variance** = Σ credited − weekly contracted (default 37:30) − the
   claimed minutes the week keeps after rule 8. Daily minimums never change
   this number.
6. **Flexi (Q4):** a week's variance is booked on its Sunday, once the week has
   ended (`asOf` is on or after that Sunday). The week in progress shows
   progress ("22:30 of 37:30"), not a negative variance. The flexi balance as of
   a date is the sum of booked variances and flexi adjustments up to it. It can
   go negative. Credit and debit caps are unset by default; when set, a balance
   past a cap raises a warning. A forfeit happens only when the owner confirms
   one, which creates an adjustment.
7. **Allocating a claim to days** (Q1), defined
   [below](#rule-7-allocating-a-claim-to-days).
8. **Claim clamping:** if later edits shrink the week's excess below the claim,
   the effective claim is reduced (overtime first, then TOIL) to the excess, and
   a warning is shown. The stored claim is not changed.
9. **Monthly TOIL cap:** walk the calendar month's days in date order and add up
   the TOIL allocated to each day. The allocated minutes that take the total past
   the cap (default 7:30) become overtime on that day.
10. **Month-end conversion:** at the end of a month (`asOf` on or after its last
    day), unused TOIL = TOIL allocated in the month (after the cap) − TOIL taken
    in the month. If positive, it becomes overtime booked on the last day of the
    month. If negative (taken but never earned), the shortfall is booked as a
    flexi debit on that day, with a warning. TOIL never carries into the next
    month.
11. **Overtime classification (Q2):** overtime minutes from a claim, the cap or
    month-end conversion are **paid** when the terms in force have
    `overtimeEligible` **and** that calendar month is approved for paid overtime.
    Otherwise they are **unpaid**. Not eligible means always unpaid.
12. **Leave year:** used = leave + bank holiday credit, for dates in the year.
    Remaining = allowance (default 247:30) + 37:30 if bought leave is set for
    that year + leave adjustments − used. It can go negative, with a warning.
13. **Warnings** (they never change a number): a working day with credited time
    below its minimum, once the day is past; a start before or end after the
    working band (default 07:00–19:00); a past working day with nothing
    recorded; the flexi caps (rule 6); TOIL over the cap or unused (rules 9–10);
    leave over allowance; claim clamping (rule 8); a break raised to the minimum
    (rule 2, an informational note).
14. **Display:** `h:mm` (`7:30`); signed variance (`+3:00 over`,
    `−1:15 under`); decimal hours only in CSV.

#### Rule 7: allocating a claim to days

The owner marks how much of a week's excess to take out of flexi, as TOIL
minutes and overtime minutes (one claim per week). The engine then decides
**which days** those minutes sit on. This matters for the monthly TOIL cap and
for monthly totals when a week spans two months. It is the owner's "best place
to average hours": take from the days furthest above their minimum until they
are level.

1. For each day in the week with worked time, **surplus** = worked − that day's
   minimum (the minimum is 0 on a non-working day).
2. **Take one minute at a time** from the day with the **largest remaining
   surplus**. On a tie, take from the **latest date**, so time lands later and
   there is more of the month left to take TOIL. A day never gives more than its
   worked minutes.
3. Repeat until the claim is allocated. The result is the same as levelling the
   highest days down to a common line.
4. **TOIL is allocated first**, then overtime continues from the surpluses that
   remain.

The claim is limited to the week's excess, and the excess is never more than
the week's worked time, so step 3 always finishes.

**Worked example.** Week of Monday 5 October 2026. Terms are the defaults
(37:30; minimums 7:30 Mon–Thu, 5:30 Fri; break 0:30 over 6:00), and the owner is
eligible for overtime.

| Day     | Start–end   | Break recorded | Break deducted | Worked | Minimum | Surplus |
| ------- | ----------- | -------------- | -------------- | ------ | ------- | ------- |
| Mon 5   | 08:00–17:30 | 0:30           | 0:30           | 9:00   | 7:30    | 1:30    |
| Tue 6   | 07:30–18:00 | 0:30           | 0:30           | 10:00  | 7:30    | 2:30    |
| Wed 7   | 08:00–16:00 | 0:30           | 0:30           | 7:30   | 7:30    | 0:00    |
| Thu 8   | 08:00–17:00 | 0:15           | 0:30 (rule 2)  | 8:30   | 7:30    | 1:00    |
| Fri 9   | 08:00–13:30 | 0:00           | 0:00 (≤ 6:00)  | 5:30   | 5:30    | 0:00    |
| **Sum** |             |                |                | 40:30  |         |         |

- **Week excess** = 40:30 − 37:30 = **3:00**. The owner claims **2:00 as TOIL**.
- **Allocation:** Tue has the largest surplus, so it gives 1:00 until it is level
  with Mon at 1:30. Mon and Tue then share the next 1:00, 0:30 each, until both
  are level with Thu at 1:00. The claim is used up.
- **Result:** TOIL Tue 1:30, Mon 0:30. The days now read Mon 8:30, Tue 8:30,
  Wed 7:30, Thu 8:30, Fri 5:30. The remaining **+1:00** is booked to flexi on
  Sunday 11 October.
- **Monthly cap (rule 9):** suppose TOIL of 6:30 was already allocated on 1 and 2
  October. Walking October in date order: 6:30 + Mon 0:30 = 7:00; Tue's 1:30
  takes it to 8:30. So on Tue, **0:30 stays TOIL** and **1:00 becomes
  overtime**. October is not approved for paid overtime, so the 1:00 is
  **unpaid** (rule 11).
- **Month end (rule 10):** if the owner takes 5:00 TOIL in October, the unused
  7:30 − 5:00 = **2:30** becomes overtime on 31 October. It is unpaid unless
  October is approved.

**Unit test matrix** (Vitest; fixed dates; no wall clock):

- **Worked time:** a span exactly 6:00 and 6:01; a recorded break above and below
  the minimum; a zero or negative span (invalid); a span over 24 hours (invalid);
  a night shift past midnight counting to its start date.
- **Clock changes:** Sat 28 Mar 2026 22:00 – Sun 29 Mar 06:00 is a 7:00 span;
  Sat 24 Oct 2026 22:00 – Sun 25 Oct 06:00 is 9:00; Sun 25 Oct 2026 00:30–03:30
  is 4:00. Repeat for 28 Mar and 31 Oct 2027. Week totals for all four weeks.
- **Weeks:** week variance with and without leave, TOIL taken and bank holidays;
  a week in progress (no booking); a terms change taking effect on a Monday;
  weekend work (minimum 0).
- **Allocation:**
  - the worked example;
  - all surpluses equal (latest date wins);
  - a claim equal to the whole excess;
  - a claim needing minutes from below a day's minimum;
  - TOIL and overtime in one claim;
  - clamping after an edit.
- **Month boundaries:**
  - a week straddling 30 Sep – 4 Oct, with allocation landing in both months;
  - the TOIL cap exactly at 7:30 and one minute over;
  - unused TOIL at month end, positive and negative;
  - TOIL taken before it is earned in the same month.
- **Overtime:** not eligible, eligible but not approved, eligible and approved.
- **Leave:** 7:30 maximum; bank holidays deducted; bought leave; bank holiday
  worked; an allowance going negative; a leave adjustment.
- **Flexi:** a negative balance; caps unset, then set and crossed; a confirmed
  forfeit.
- **Warnings:** the minimum on Mon–Thu vs Fri; band edges at exactly 07:00 and
  19:00; a missing past day.
- **Parser and formatter:** `0830`, `830`, `8:30`, `08.30`, `7` → 07:00, `24:00`
  and `25:00` invalid; negative values and totals over 24 hours.

### Data model

Standard columns on every table (UUID v7 `id`, `owner_id`, `created_at`,
`updated_at`, `deleted_at`, `version`), per [DATABASE.md](../DATABASE.md).
Durations are `Int` minutes. **Run database-architect before each migration.**
Uniqueness is on active rows through partial unique indexes written in the SQL.
One row per date means there are no overlapping spans on the same date, so there
is **no exclusion constraint and no `btree_gist`**. The service checks that a
past-midnight end does not run into the next day's start (422).

**Core** (`modules/core/`, ADR-0020 §2):

- **`public_holidays`** (`PublicHoliday`): `date date`, `name text`; unique active
  `(owner_id, date)`. Rows are imported from a bundled England and Wales list
  (Q3); there is no runtime network call.

**Tool-owned** (`modules/hours/`):

- **`work_terms`** (`WorkTerms`), effective-dated settings:
  - `effective_from date`, `CHECK` that it is a Monday; unique active
    `(owner_id, effective_from)`;
  - `weekly_contracted_minutes int` (2250);
  - `min_minutes_mon` … `min_minutes_sun int NULL`, where null means not a
    working day (450 Mon–Thu, 330 Fri, null Sat–Sun);
  - `break_threshold_minutes int` (360), `break_minimum_minutes int` (30);
  - `band_start time(0)` (07:00), `band_end time(0)` (19:00), with
    `CHECK band_end > band_start`. `time` is new to DATABASE.md's type table;
    database-architect adds it;
  - `overtime_eligible boolean`;
  - `toil_monthly_cap_minutes int` (450);
  - `leave_day_max_minutes int` (450);
  - `flexi_credit_cap_minutes int NULL`, `flexi_debit_cap_minutes int NULL`
    (null, so no cap);
  - `CHECK`s that minutes are within 0–1440, or 0–10080 for weekly minutes.
  - The earliest active `effective_from` is the **tracking start** (a Monday).
- **`work_days`** (`WorkDay`), one per date:
  - `date date`, unique active `(owner_id, date)`;
  - `starts_at timestamptz(3) NULL`, `ends_at timestamptz(3) NULL`, with
    `CHECK` both-or-neither, `ends_at > starts_at`, and at most 24 hours. The
    service checks that `starts_at` falls on `date` in `Europe/London`;
  - `break_minutes int default 0`;
  - `leave_minutes int default 0`, `toil_taken_minutes int default 0`, each
    `CHECK` 0–1440. The rule maximum (7:30) comes from `work_terms` and is
    checked in the service;
  - `bank_holiday_worked boolean default false`;
  - no note and no activity: the owner deferred recording what time was spent
    on, and adding a nullable `note` later is additive.
- **`extra_time_claims`** (`ExtraTimeClaim`), one per week:
  - `week_start date` (`CHECK` Monday), unique active `(owner_id, week_start)`;
  - `toil_minutes int`, `overtime_minutes int`, both `>= 0`, with
    `CHECK toil_minutes + overtime_minutes > 0`.
- **`overtime_approvals`** (`OvertimeApproval`), a month approved for paid
  overtime (Q2):
  - `month date`, `CHECK` it is the 1st; unique active `(owner_id, month)`;
  - the row's presence is the approval, and deleting it (with undo) withdraws it.
- **`leave_years`** (`LeaveYear`):
  - `year int` (`CHECK` 2000–2100), unique active `(owner_id, year)`;
  - `allowance_minutes int default 14850` (247:30);
  - `bought_leave boolean default false` (+2250).
- **`time_adjustments`** (`TimeAdjustment`):
  - `effective_date date`;
  - `balance` enum `FLEXI | TOIL | LEAVE`;
  - `minutes int` (signed, `CHECK <> 0`);
  - `reason` enum `OPENING_BALANCE | FORFEIT | CORRECTION`;
  - index `(owner_id, effective_date)`.

Range reads use the unique indexes, which lead with `owner_id`. Nothing derived
is stored. At personal scale (under 400 rows a year) balances are computed on
read; a stored monthly snapshot is added only if a measurement shows the need.

**Migrations:** two additive migrations, in slices 4 and 6.
No destructive changes. A `pg_dump` is still taken before each deploy.

### API

All endpoints are under `/api/v1`, authenticated, with OpenAPI tag `Hours` (or
`Core`), and generated with `pnpm gen:feature <entity> --tool hours` (or
`--core`), then adapted. Ids use `ParseUuidPipe`. Instants are ISO with `Z`,
dates `YYYY-MM-DD`, and durations are integer `…Minutes` fields. Every change is
additive, so there is no breaking contract change, and `pnpm contract:generate`
runs in each API slice.

| Method and path                                         | Purpose                                                                                                                | Status codes                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `GET /work-days?from&to&limit&cursor`                   | Days in `[from, to)`, sorted by `date` asc                                                                             | 200, 400, 401, 422                           |
| `POST /work-days`                                       | `{ date, startsAt?, endsAt?, breakMinutes, leaveMinutes, toilTakenMinutes, bankHolidayWorked }`                        | 201, 401, 409 (date exists), 422             |
| `GET/PATCH/DELETE /work-days/:id`, `POST …/:id/restore` | Read, update with `version`, soft delete, undo                                                                         | 200/204, 400, 401, 404, 409, 422             |
| `GET/POST /extra-time-claims`, `…/:id`, `…/:id/restore` | Claims by `weekStart`; 422 if the claim exceeds the week's excess when saved                                           | as above                                     |
| `GET/POST/DELETE /overtime-approvals`, `…/:id/restore`  | Months approved for paid overtime                                                                                      | as above                                     |
| `GET/POST /work-terms`, `GET/PATCH/DELETE …/:id`        | Effective-dated terms; deleting the last remaining one is refused (422)                                                | as above                                     |
| `GET/POST/PATCH /leave-years`, `…/:id`                  | Allowance and bought leave per year                                                                                    | as above                                     |
| `GET/POST /time-adjustments`, `…/:id`, `…/:id/restore`  | Opening balances, forfeits, corrections                                                                                | as above                                     |
| `GET /time-summaries?from&to&groupBy=day\|week\|month`  | Computed groups: credited, worked, leave, TOIL allocated/taken/converted, overtime paid/unpaid, flexi at end, warnings | 200, 401, 422 (over 366 days, `to` ≤ `from`) |
| `GET /time-balances?asOf`                               | `{ flexiMinutes, toilMonthMinutes, leaveRemainingMinutes, overtimePaidYearMinutes, overtimeUnpaidYearMinutes }`        | 200, 401, 422                                |
| `GET/POST /public-holidays`, `…/:id`, `…/:id/restore`   | Core: list by range, manual add, delete                                                                                | as above                                     |
| `POST /public-holiday-imports`                          | `{ year }`: adds the missing bundled dates for that year                                                               | 200 (nothing new), 201, 401, 422             |

- **Ownership** is enforced in the service on every read, update, delete and
  restore. Another owner's id gets the same 404.
- **Duplicate dates** and restoring onto an occupied date or week return 409
  through the existing `P2002` mapping. The web edits existing days with `PATCH`.
- **Computed read-models** (ADR-0020 §4): the service loads the terms, days,
  claims, approvals, leave years, adjustments and holidays it needs with bounded,
  owner-scoped range queries. It extends the range to whole weeks and months so
  booking and conversion are correct, then calls `@repo/domain`. The web passes
  `asOf` (today in `Europe/London`), so no `Clock` seam is needed.
- **Limits in `@repo/types`:** break ≤ 1440 minutes; claim minutes ≤ 10080.

### UI

Desktop, at least 1280px wide, compact density (14px text, 32px rows), per
[UX_STANDARDS.md](../UX_STANDARDS.md). Composed from shared primitives; new
primitives follow DESIGN_SYSTEM.md's planned specs.

**Sidebar:** Hours (Lucide `Clock`), from `features/hours/tool.ts` through
`app/tools.ts`; `aria-current="page"` on `/hours/*`; a tooltip and accessible
name in the rail state.

**Routes and URL state:**

| Route             | Search params (Zod-validated)                                         | Content                     |
| ----------------- | --------------------------------------------------------------------- | --------------------------- |
| `/hours`          | `week` (a Monday; other dates are normalised with a replace redirect) | Week view (the tool's home) |
| `/hours/summary`  | `from`, `to`, `groupBy=week\|month`                                   | Summaries                   |
| `/hours/settings` | `tab=terms\|leave\|balances\|holidays`                                | Settings                    |

**Week view** (`/hours`):

```text
┌ Hours ────────────────────────────── ‹ Week of 5 Oct 2026 › [This week] ┐ ┌ This week ──────────────────┐
│ Day       Start  End    Break  Leave  TOIL taken  Worked  Credited  ⚠ ⋯ │ │ Credited 40:30 of 37:30      │
│ Mon 5 Oct 08:00  17:30  0:30                        9:00     9:00     ⋯ │ │ Excess   +3:00 over          │
│ Tue 6 Oct 07:30  18:00  0:30                       10:00    10:00     ⋯ │ │ Claim  TOIL [2:00] OT [0:00] │
│ Wed 7 Oct 08:00  16:00  0:30                        7:30     7:30     ⋯ │ │        [Save claim]          │
│ Thu 8 Oct 08:00  17:00  0:15 → 0:30                 8:30     8:30     ⋯ │ │ To flexi +1:00               │
│ Fri 9 Oct 08:00  13:30                              5:30     5:30     ⋯ │ ├ Balances (to today) ─────────┤
│ Sat 10 Oct —                                                          ⋯ │ │ Flexi         +3:12          │
│ Sun 11 Oct —                                                          ⋯ │ │ TOIL Oct      6:30 of 7:30   │
└─────────────────────────────────────────────────────────────────────────┘ │ Overtime (yr) 1:00 unpaid    │
                                                                            │ Leave left    120:00         │
                                                                            └──────────────────────────────┘
```

- **Layout:** a page header (one `<h1>` "Hours", the week navigator, and "Go to
  today" as the one primary action, which focuses today's Start field). Then a
  CSS grid: a full-bleed day table, and a fixed-width aside that stacks below
  the table when the reflow floor is reached.
- **Table:** a real `<table>` with one row per day (seven rows) and a row header
  per date. Bank holidays show a badge ("Bank holiday · 7:30 credited"). There
  is no `role="grid"`: cells hold ordinary inputs, and Tab order is the keyboard
  model. Numeric columns are right-aligned with tabular numerals. After a claim,
  a TOIL/OT column shows each day's allocation.
- **Rows are small forms.** Tab moves Start → End → Break → Leave → TOIL taken →
  row menu. **Enter saves the row**; **Esc reverts** it. A changed row shows
  "Unsaved" and a Save button, and the view blocks navigation while rows are
  unsaved (UX_STANDARDS.md → Forms). Saving an empty row that was never saved
  does nothing. Validation runs on blur and save, with errors inline.
- **`TimeInput`** primitive: a text input with a "24-hour, e.g. 08:30" hint
  linked by `aria-describedby`. It parses on blur. An end earlier than the start
  shows a "+1 day" tag that screen readers also hear. A duration input for break,
  leave and TOIL taken accepts `0:30`, `30m`, `7.5h` and shows `h:mm`.
- **Warnings** use a ⚠ icon with text in the row ("Below 7:30 minimum", "Before
  07:00") and a list in the aside. There is no colour-only meaning. Warnings
  never block saving.
- **Claim panel** in the aside: the week excess; TOIL and overtime duration
  inputs, limited to the excess (inline error above it); "Save claim"; and a
  preview of the allocation and what stays in flexi, computed live with
  `@repo/domain`. When the terms are eligible it also shows the month's
  approval state, with an "Approve paid overtime for October" toggle.
- **Row menu (⋯)**, mirrored by a right-click menu: Clear day, Mark bank holiday
  as worked (holidays only). Clear day soft-deletes the row, shows "Day cleared ·
  Undo" for 8 seconds, and moves focus to the next row. Deleting a claim works
  the same way. There are no single-key shortcuts.
- **Totals** are computed in the browser from saved data plus unsaved rows, and
  re-read from `time-summaries` and `time-balances` after each save. A polite
  live region in the aside announces updated totals after a save, not on every
  keystroke.
- **States:**
  - loading: skeleton rows at the final height (after 300ms);
  - no work terms yet: "Set your working terms to start tracking hours", linking
    to settings;
  - weeks before the tracking start: "Tracking starts on 7 Sep 2026";
  - empty week: the seven editable rows plus "No time recorded this week";
  - error: an inline table error with Retry that keeps the header;
  - partial: rows loaded but totals failed, so an error with Retry in the aside
    only;
  - a save failure: a persistent error toast, and the row keeps its input.

**Summary** (`/hours/summary`):

- A page header with presets (This month, Last month, This year, Custom) and
  "Download CSV" as the primary action.
- A table with one row per week or month:
  - credited, worked, leave, bank holidays;
  - variance, flexi at the end;
  - TOIL allocated, taken and converted;
  - overtime paid and unpaid.
- A totals row, warning badges with text, and a leave-year strip (allowance, used,
  remaining).
- The empty range state reads "No time recorded between these dates".

**Settings** (`/hours/settings`, tab in the URL):

- **Terms:** an explicit-save form for new terms from a Monday: weekly hours,
  working days and minimums, break threshold and minimum, band, overtime
  eligibility, TOIL cap, maximum leave per day, and flexi caps. Earlier terms are
  listed read-only, with delete and undo.
- **Leave:** a row per year with the allowance and a bought-leave toggle, and
  used and remaining hours.
- **Balances:** opening flexi, TOIL and leave-used adjustments on the tracking
  start date; confirmed forfeits.
- **Holidays:** a list by year, "Add bank holidays for <year>", manual add, and
  delete with undo.

**Command palette** (declared in the manifest; active once the palette is
built, outside this feature):

- Go to Hours
- Hours: go to today
- Hours: open summary
- Hours: download this month as CSV
- Hours: open settings

### Temporal and bundle impact

- **Choice:** `temporal-polyfill` (FullCalendar), not `@js-temporal/polyfill`.
  - It is spec-compliant and about **20 kB gzipped**.
  - `@js-temporal/polyfill` is the proposal champions' reference implementation.
    It is noticeably larger and slower, and its own documentation has not
    positioned it for production use.
  - Both expose the same `Temporal` API, so switching costs one import.
- **Native Temporal:** Firefox shipped it in 139 (2025), and Chromium in 144
  (early 2026). Node 24 does not have it, so the API needs a polyfill.
  - For identical behaviour in both apps and in tests, `@repo/domain` always uses
    the polyfill through one module (`core/time/temporal.ts`), never
    `globalThis.Temporal`.
  - Switching to native is a one-file change once Node and both browsers have
    it. Re-check versions at slice 3.
- **Bundle:** the polyfill and the engine load only in the `/hours` route chunks
  (`autoCodeSplitting`), not in the shell or sign-in. Slice 3 records the
  measured chunk size in the PR against FRONTEND_QUALITY.md's budgets.

### Export

Backups are not built yet (PRODUCT.md → Next), so export comes early:

- **CSV** (client-side, the shown range): days (date, start, end, break
  recorded and deducted, worked, leave, TOIL taken, credited, in `h:mm` and
  decimal hours) and, with the summary slice, week and month rows. It uses a
  unit-tested CSV builder with quoting and a formula-injection guard.
- **JSON:** `pnpm data:export`, the server CLI command DATABASE.md plans,
  following the `cli/` pattern (ADR-0018). It writes every owned domain table.

### Dependencies and reuse

- **Reused:** the reference template and generator (ADR-0015), envelopes and
  `AllExceptionsFilter` (including `P2002` → 409), `ParseUuidPipe`,
  `@CurrentUser()`, `apiClient` and TanStack Query, `Form`/`Input`/`Button`/`Alert`,
  and the `cli/` bootstrap.
- **Built here because hours needs them first:**
  - the sidebar and tool registry, and `lib/preferences.ts`;
  - the Tooltip, Toast (with undo), DropdownMenu/ContextMenu, Skeleton, Tabs,
    `TimeInput` and duration input primitives;
  - the template's restore endpoint and transaction-capable repositories (both
    in BACKLOG.md);
  - the generator's `--tool`/`--core` flags;
  - `packages/domain`.
- **Not built here:** the command palette (PRODUCT.md → Later); the app shell's
  token retune (PRODUCT.md → Next; slice 1 takes only the sidebar and content
  width); `DataTable`.
- **Deployment:** building does not wait for login hardening or backups, but
  WorkHub stays off the internet until they exist.

## Slices

Each slice is one PR that leaves `main` releasable and ships its tests. Slices
3 onwards wait for final approval and answers to the open questions.

1. **Tool registry and sidebar:** `ToolManifest`, `app/tools.ts` (Home only),
   the sidebar (expanded or rail, persisted, applied before first paint),
   Tooltip, content width. Tests: component tests (rail labels, tooltip,
   `aria-current`); Playwright + axe at 1280 and 1920 and the rail at 400% zoom.
2. **Template and generator groundwork:** the template's restore endpoint and
   optional transaction client; `gen:feature --tool`/`--core`, with
   verify-template covering `--tool`; the ADR-0020 doc updates
   (BACKEND_ARCHITECTURE, REFERENCE_FEATURE, FRONTEND_ARCHITECTURE, API.md).
   Tests: the template's restore e2e; CI template verification.
3. **Calculation engine:** `packages/domain` (Turborepo, lint, Vitest),
   `core/time` on `temporal-polyfill`, the `hours/` rules 1–14 and allocation,
   the parser and formatter. Tests: the full unit matrix. Reviews:
   security-reviewer (new dependency).
4. **Settings API:** `work-terms`, `leave-years`, `time-adjustments`, and core
   `public-holidays` with the bundled import; migration 1. Tests: API e2e for
   every status code, ownership 404, 409 version and duplicate, 422 rules
   (non-Monday, last terms, import year). Reviews: database-architect first.
   Split the core holidays into their own PR if the diff is large.
5. **Settings UI:** the settings route and its four tabs; the Tabs, Toast and
   DropdownMenu primitives; `TimeInput` and the duration input. Tests: component
   tests for the inputs and forms; Playwright + axe for setting terms, a leave
   year with bought leave, holidays import, and undo.
6. **Work days, claims and approvals API:** `work-days`, `extra-time-claims`,
   `overtime-approvals`; migration 2. Tests: API e2e for CRUD and restore,
   duplicate date 409, the past-midnight collision 422, BST-night instants,
   a claim over the excess 422, and ownership.
7. **Week view:** `/hours?week`, the seven day-row forms, live day totals,
   warnings, Clear day with undo, and the Hours manifest in the sidebar. Tests: a
   keyboard-only Playwright journey (enter a week, a night shift, leave, undo)
   with axe at 1280 and 400% zoom.
8. **Export:** CSV of days for the shown range, and `pnpm data:export`. Tests:
   CSV builder unit tests; a CLI test against the `_test` database. Reviews:
   security-reviewer.
9. **Summaries and balances API:** `time-summaries` and `time-balances` on
   `@repo/domain`. Tests: API e2e for range 422, week and month
   grouping, a straddling week, the TOIL cap and month-end conversion,
   paid/unpaid classification, and ownership (another owner's rows never
   counted).
10. **Aside, claims and summary view:** week totals and balances, the claim
    panel with allocation preview and month approval, `/hours/summary` with URL
    range, and summary CSV. Tests: Playwright + axe for claiming TOIL, approving
    a month and reading the summary; browser totals equal API totals for the
    seeded worked-example week.

That is ten slices, one fewer than before. The simpler one-row-per-day model
removes the overlap constraint, and holidays and leave fold into the settings
and week slices.

**Follow-ups outside this branch:**

- **PRODUCT.md** (in slice 1, or the PR that approves this doc): replace
  _Purpose: TBD_ with "WorkHub is a set of modular tools for the owner's
  construction management and Home Office construction engineering work, with
  data shared across tools." Add the glossary above; record the Hours tracker in
  _Now_.
- **CLAUDE.md** §1: "Purpose and domain: TBD" gets the same wording.
- **ADR-0020:** Status → Accepted at final approval, with its index row updated.
- **When slice 10 lands:** Status → Shipped, the feature inventory, as-built
  notes.

## Decisions & open questions

### Answered by the owner (2026-09-16)

1. **Contracted time.** "i work 37.5hrs per week (mon to fri) but the hours can
   vary per day. Would say a minimum of 5.5hrs on a friday and minimum of 7.5hrs
   mon to thur". Flexi is **weekly** credited time vs 37:30. The daily minimums
   (7:30 Mon–Thu, 5:30 Fri) only raise warnings. Weekly hours, working days and
   minimums are effective-dated settings.
2. **Extra time.** "time goes to flex balance and can go negative. time only
   counts as overtime when marked. there should be a setting that lets the user
   toggle if they are eligible for overtime or not. if they are not eligible
   then it goes to unpaid overtime.. maximum amount of toil is 7.5hrs a month and
   it must be taken in the same month. only toil accrued and not used in the same
   month does not roll over and is then converted to overtime (paid or unpaid
   depending on eligibility and permission)". Built as rules 6 and 9–11 and
   `overtime_eligible`.
3. **Overtime reward:** TOIL or paid overtime, hour for hour, in hours only (no
   money).
4. **Marking with one start and end per day.** "calculation runs to calculate
   overtime / toil over the week and then assigns it to days based on best place
   to average hours". Reconciled with answer 2 as **rule 7** (a week-level claim
   allocated by levelling), which waits for confirmation (open question 1).
5. **TOIL cap:** TOIL over 7:30 in a calendar month, and unused TOIL at month
   end, become overtime, paid or unpaid by eligibility and approval. "Permission"
   is modelled cheaply as a month-level approval (open question 2).
6. **Breaks:** record actual breaks; spans over 6:00 have at least 0:30
   deducted; the threshold and minimum are settings.
7. **Period:** calendar month.
8. **Caps and carry-over:** flexi caps are settings, unset by default; a warning
   when one is crossed; a forfeit only on confirmation.
9. **Leave.** "leave is based on hours with no minimum per day. max leave per day
   is 7.5hrs. current leave allowance is 247.5hrs per year jan to dec. and this
   includes the uk bank holiday (i.e. 25 x 7.5hrs core + 8 x 7.5hr bank holidays.
   there is an option to purchase an additional 5 \* 7.5hrs day leave a year".
   - Bought leave is a per-year toggle adding 37:30.
   - Bank holidays deduct from the allowance.
   - The region is England and Wales (8 days) by assumption (open question 3).
10. **Working band:** warn outside it; default 07:00–19:00, editable.
11. **Recording:** one start, end and break per day, so `work_days` has one row
    per date. The overlap constraint and `btree_gist` are dropped.
12. **Activity:** none for now ("leave what time was spent on for now"). Notes
    are dropped too; a nullable note can be added later without a breaking
    change.
13. **Architecture:** ADR-0020 approved as drafted. It stays Proposed until
    final approval.
14. **Calculation engine:** "Shared package on Temporal": `@repo/domain` on
    `temporal-polyfill` (see [Temporal and bundle impact](#temporal-and-bundle-impact)).

### Open questions

1. **How a week's extra time becomes TOIL or overtime.** Recommended: the owner
   claims an amount per week, and it is allocated to days by levelling (rule 7).
   Alternatives:
   - automatic: the whole week's excess becomes TOIL (up to the cap), then
     overtime, and the owner un-marks any that should stay flexi;
   - the owner marks TOIL or overtime on individual days, and the tool only
     checks the week total against the excess;
   - a whole-week toggle: all of the week's excess goes to TOIL or overtime,
     allocated by levelling.
2. **What "permission" for paid overtime means.** Recommended: approval per
   calendar month (one toggle covering claimed, capped and converted overtime).
   Alternatives: approval per weekly claim (conversions then need an origin
   rule); no approval (eligible means paid).
3. **Bank holiday region.** Recommended: England and Wales (8 a year).
   Alternatives: Scotland; Northern Ireland.
4. **When a week's flexi counts.** Recommended: booked when the week ends, on its
   Sunday, with the current week shown as progress. Alternative: counted day by
   day as the week goes, against 7:30 a working day, with the remainder settled
   on Friday.

### Stated defaults (not asked; change on request)

- Work terms and the tracking start take effect on a Monday. Each week uses the
  terms in force on its Monday.
- A night shift counts wholly to its start date.
- Leave and TOIL taken are recorded only on working days.
- Claimed minutes cannot exceed the week's excess when saved. Later edits clamp
  the claim with a warning.
- TOIL is allocated before overtime. On an allocation tie the latest date wins.
- TOIL taken but not earned by month end becomes a flexi debit, with a warning.
- Exact minutes, no rounding; `h:mm` display.

## As-built notes

None yet.
