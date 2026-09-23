# Hours tracker

- **Status:** Approved (2026-09-16). Building: slices 1–4, 6, 8 and 9 of 10 done
  ([build order](#slices)).
- **Change class:** Feature, built on
  [ADR-0020](../adr/0020-modular-tools-over-shared-core-data.md) (Architectural,
  Accepted 2026-09-16). Escalation triggers: database
  migrations, ownership code, a new runtime dependency (`temporal-polyfill`),
  and a new workspace package (`@repo/domain`).
- **Tool id:** `hours` · **Sidebar label:** Hours · **Web root:** `/hours`

## Problem & outcome

The owner works in construction management and Home Office construction
engineering, and has no single record of hours worked. Start and finish times,
breaks, flexi, time off in lieu (TOIL), overtime and leave are worked out by
hand.

When this ships the owner can:

- type one start, end and break per day into a dense week view, keyboard first;
- see flexi build up day by day against a 7:30 daily target (37:30 a week). The
  balance can go negative;
- switch on "convert this week's excess" for a week. At settlement the week's
  net excess becomes TOIL, up to 7:30 a month, and the rest becomes overtime,
  spread over the days by levelling;
- see unused TOIL convert to overtime at month end. Overtime is paid only while
  paid overtime is allowed in the settings;
- record leave in hours against a 247:30 yearly allowance, with England and
  Wales bank holidays deducted;
- get warnings for short days, time outside the working band, and caps;
- review weekly and monthly summaries, and export the data.

## Glossary

Use these terms in code, UI copy and docs (they move to PRODUCT.md's glossary
on approval). Every duration is whole minutes.

| Term                  | Meaning                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Work day**          | One row for a date: an optional start and end, break, leave, TOIL taken, and whether a bank holiday was worked.                    |
| **Worked time**       | The span from start to end, minus the deducted break (rule 3).                                                                     |
| **Credited time**     | Worked time + leave + TOIL taken + bank holiday credit.                                                                            |
| **Daily target**      | The time a working day is expected to credit for flexi: 7:30 Mon–Fri. It drives the maths.                                         |
| **Daily minimum**     | The least time the owner should work on a day: 7:30 Mon–Thu, 5:30 Fri. It raises a warning only and never changes a number.        |
| **Day flexi**         | Credited time minus the daily target (the target is 0 on a non-working day), less any minutes converted on that day.               |
| **Settlement day**    | The last working day of a week (Friday by default). The week's conversion applies from then.                                       |
| **Excess conversion** | The owner's per-week switch. When on, the week's net positive flexi at settlement becomes TOIL and overtime.                       |
| **TOIL**              | Converted time to be taken off in the same calendar month; at most 7:30 a month.                                                   |
| **Overtime**          | Converted time over the TOIL cap, or TOIL unused at month end. **Paid** if paid overtime is allowed on that date, else **unpaid**. |
| **Work terms**        | Effective-dated settings: targets, minimums, break rule, band, paid overtime allowed, caps, maximum leave per day.                 |
| **Leave year**        | 1 January to 31 December, with an allowance in hours (247:30, plus 37:30 bought leave when chosen).                                |
| **Time adjustment**   | A signed, dated correction: an opening balance, a confirmed flexi forfeit, a correction.                                           |

## Acceptance criteria

- [ ] The sidebar shows **Hours**. It opens `/hours` on the current week in
      `Europe/London`, and `?week=YYYY-MM-DD` (that week's Monday) is in the
      URL, so reload, back/forward and bookmarks restore the week.
- [ ] The owner can enter, edit and clear one start, end and break per day, plus
      leave and TOIL taken, using only the keyboard. Times are typed as `0830`,
      `830`, `8:30` or `08.30`, and an end before the start is shown as past
      midnight.
- [ ] Each day shows worked time, credited time and day flexi as `h:mm`. The
      week shows credited vs target, the flexi balance, TOIL this month,
      overtime (paid and unpaid) and leave remaining. A sign and a word show
      direction, not colour alone.
- [ ] Totals update while the owner types, before saving, and match what the API
      returns after saving.
- [ ] With the week's conversion switch on, the week's net positive flexi at
      settlement becomes TOIL, up to the monthly 7:30 cap by allocation date,
      and then overtime. It is spread over days by the
      [levelling rule](#rule-6-allocating-a-weeks-excess-to-days). A preview
      shows the result before settlement.
- [ ] TOIL unused at month end becomes overtime. Overtime is paid only where the
      terms on that date allow paid overtime; otherwise it is unpaid.
- [ ] Editing a day in a settled week recalculates its week and months and tells
      the owner what changed.
- [ ] Leave is recorded in hours (more than 0, at most 7:30 a day). England and
      Wales bank holidays credit 7:30 and are deducted from the 247:30
      allowance. Bought leave adds 37:30 for a year.
- [ ] Warnings (not errors) appear for:
  - a day below its minimum;
  - time outside the working band;
  - a past working day with nothing recorded;
  - a flexi cap crossed;
  - TOIL unused at month end;
  - leave over the allowance.
- [ ] Clearing a day removes it at once and shows an 8-second undo toast; undo
      restores it.
- [ ] Work terms are effective-dated from a Monday. A change never alters results
      for dates before it.
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
`asOf` (today in `Europe/London` from the web). Both apps run the same code
(ADR-0020 §5). Dates and zones use **Temporal** through `temporal-polyfill`.
All arithmetic is in **integer minutes**. Every result is recomputed from the
current rows; nothing derived is stored, so the same inputs always give the
same outputs.

1. **Terms in force.** For a date, use the active work terms with the latest
   `effectiveFrom` on or before it. `effectiveFrom` is always a Monday, so a week
   never mixes terms. A day with a **target** is a working day; a day without one
   is not.
2. **Weeks** run Monday to Sunday. The **settlement day** is the week's last
   working day (Friday by default).
3. **Worked time** = elapsed minutes from `startsAt` to `endsAt` on instants,
   minus the deducted break.
   - If the span is over the break threshold (default 6:00), the deducted break
     is the recorded break or the break minimum (default 0:30), whichever is
     larger. Otherwise it is the recorded break.
   - A night across a clock change is an hour shorter (March) or longer
     (October).
   - A night shift counts wholly to its row's date.
4. **Credited time** = worked + leave + TOIL taken + bank holiday credit.
   - **Bank holiday credit:** a working day that is an England and Wales bank
     holiday credits the maximum leave per day (7:30), unless the row marks it
     as worked.
   - Leave, TOIL taken and bank holiday credit are allowed only on working days.
     Together they are at most that day's target, so time off can never create
     excess.
5. **Day flexi (raw)** = credited − target (target 0 on a non-working day).
   - A day counts once it is in the past (`date < asOf`), or it is today and has
     a row.
   - A past working day with no row counts as −target, with a warning.
   - Daily minimums never change this number.
6. **Week excess and conversion.**
   - **Excess** E = max(0, Σ raw day flexi over the week's counted days).
   - If the week's conversion switch is **off**, nothing converts: every day
     keeps its raw flexi.
   - If it is **on** and `asOf` is on or after the settlement day, E is
     allocated to days by [levelling](#rule-6-allocating-a-weeks-excess-to-days).
     Each day's **day flexi** = raw − allocated minutes, and the allocated
     minutes on that date become **converted minutes**.
   - A week with a net zero or negative total has E = 0, so nothing is
     allocated. The switch stays on and the week shows "Nothing to convert".
   - Before settlement, the conversion is only a **preview** and changes no
     balance.
   - Weekend time entered after settlement joins the same week and recomputes
     E (rule 11).
7. **TOIL cap by allocation date.** For each calendar month, walk its days in
   date order and add up converted minutes as TOIL until the month's TOIL
   reaches the cap (default 7:30). Converted minutes beyond the cap become
   **overtime** on their date. In a week that spans two months, each day's
   converted minutes count against **the month that date falls in**.
8. **Month end.** Once `asOf` is after a month's last day:
   - unused TOIL = the month's TOIL (rule 7) − the TOIL taken in the month;
   - if positive, it becomes **overtime** dated the last day of the month;
   - if negative (taken but not earned), the shortfall becomes a flexi debit on
     that day, with a warning;
   - TOIL never carries into the next month.
9. **Paid or unpaid.** Overtime dated _d_ is **paid** if the terms in force on
   _d_ have `paidOvertimeAllowed`, otherwise **unpaid**. The default is off.
10. **Flexi balance** as of a date = Σ day flexi + month-end flexi debits +
    flexi adjustments, up to that date. It can go negative. Credit and debit caps
    are unset by default; when set, a balance past a cap warns. A forfeit happens
    only when the owner confirms one, which creates an adjustment.
11. **Edits after settlement** are ordinary edits, because everything is
    recomputed.
    - The engine returns the week's before and after figures: E, TOIL and
      overtime per month.
    - The web shows "Week of 28 Sep recalculated: TOIL 1:00 → 0:40, overtime
      2:00 → 1:40".
    - If the edit touches a month that has already ended, it adds "September
      totals changed".
12. **Leave year:** used = leave + bank holiday credit for dates in the year.
    Remaining = allowance (247:30) + 37:30 if bought leave is set + leave
    adjustments − used. It can go negative, with a warning.
13. **Warnings** never change a number:
    - a day's credited time below its minimum (credited, so a leave or bank
      holiday day does not warn);
    - a start before or an end after the band (07:00–19:00);
    - a missing past working day;
    - flexi caps;
    - TOIL unused at month end, and TOIL taken but not earned;
    - leave over the allowance;
    - a break raised to the minimum (a note).
14. **Display:** `h:mm`; signed flexi (`+0:40 over`, `−2:00 under`); decimal
    hours only in CSV.

#### Rule 6: allocating a week's excess to days

This is the owner's "best place to average hours": take the week's excess from
the days furthest above their target, levelling them down together.

1. For each counted day in the week with worked time, **surplus** = worked −
   target (target 0 on a non-working day).
2. **Take one minute at a time** from the day with the **largest remaining
   surplus**. On a tie, take from the **latest date**.
3. A day never gives more than its worked minutes. A surplus may go below zero
   if that is where the level falls.
4. Stop when E minutes are allocated.

The result is the same as levelling the highest days down to a common line.
Rule 4 caps time off at the target, so E is never more than the week's worked
minutes, and the loop always finishes.

#### Worked example

Terms are the defaults: targets 7:30 Mon–Fri; minimums 7:30 Mon–Thu and 5:30
Fri; break 0:30 over 6:00; TOIL cap 7:30; paid overtime **not allowed**.

**Week of Monday 5 October 2026, switch off (daily flexi):**

| Day     | Start–end   | Break (recorded → deducted) | Worked | Target | Day flexi | Flexi balance¹ |
| ------- | ----------- | --------------------------- | ------ | ------ | --------- | -------------- |
| Mon 5   | 08:00–17:30 | 0:30 → 0:30                 | 9:00   | 7:30   | +1:30     | +1:30          |
| Tue 6   | 07:30–18:00 | 0:30 → 0:30                 | 10:00  | 7:30   | +2:30     | +4:00          |
| Wed 7   | 08:00–16:00 | 0:30 → 0:30                 | 7:30   | 7:30   | 0:00      | +4:00          |
| Thu 8   | 08:00–17:00 | 0:15 → 0:30 (rule 3)        | 8:30   | 7:30   | +1:00     | +5:00          |
| Fri 9   | 08:00–13:30 | none (span ≤ 6:00)          | 5:30   | 7:30   | −2:00     | +3:00          |
| **Sum** |             |                             | 40:30  | 37:30  | **+3:00** |                |

¹ The flexi balance starts from 0 for the example. Friday's 5:30 meets its
minimum, so there is no warning.

**Same week, switch on.** Settlement is Fri 9 Oct, and E = **3:00**. Surpluses
are Mon 1:30, Tue 2:30, Wed 0:00, Thu 1:00, Fri −2:00.

1. Tue gives 1:00 and is level with Mon at 1:30.
2. Mon and Tue give 0:30 each and are level with Thu at 1:00 (2:00 given so far).
3. Mon, Tue and Thu give 0:20 each and level at 0:40. The loop takes one minute
   at a time, latest date first on ties.

| Day   | Raw flexi | Converted | Day flexi | Month-to-date TOIL²  | TOIL | Overtime (unpaid) |
| ----- | --------- | --------- | --------- | -------------------- | ---- | ----------------- |
| Mon 5 | +1:30     | 0:50      | +0:40     | 6:30 → 7:20          | 0:50 | —                 |
| Tue 6 | +2:30     | 1:50      | +0:40     | 7:20 → 7:30 (capped) | 0:10 | 1:40              |
| Wed 7 | 0:00      | —         | 0:00      | 7:30                 | —    | —                 |
| Thu 8 | +1:00     | 0:20      | +0:40     | 7:30 (capped)        | —    | 0:20              |
| Fri 9 | −2:00     | —         | −2:00     | 7:30                 | —    | —                 |

² Assumes 6:30 of TOIL was already converted on 1–2 October.

- The week's flexi is now 0:00, and 3:00 was converted: **1:00 TOIL and 2:00
  overtime**.
- The overtime is **unpaid**, because paid overtime is not allowed (rule 9).
- If the owner takes 5:00 TOIL in October, the unused 7:30 − 5:00 = **2:30**
  becomes unpaid overtime on 31 October (rule 8).

**Cross-month week, switch on.** Week of Monday 28 September 2026, settling Fri
2 Oct; no TOIL yet in either month.

| Day    | Worked | Raw flexi | Converted | Month     |
| ------ | ------ | --------- | --------- | --------- |
| Mon 28 | 9:30   | +2:00     | 2:00      | September |
| Tue 29 | 7:30   | 0:00      | —         | September |
| Wed 30 | 7:30   | 0:00      | —         | September |
| Thu 1  | 8:30   | +1:00     | 1:00      | October   |
| Fri 2  | 7:30   | 0:00      | —         | October   |

- E = 3:00. Levelling takes Mon down to 1:00, then Mon and Thu down to 0:00.
- The 2:00 on 28 Sep is **September TOIL**. September has ended by settlement,
  so it is unused and becomes **unpaid overtime on 30 Sep** (rule 8). Until
  2 Oct, September's figures did not include it (rule 6); rule 11 reports the
  change.
- The 1:00 on 1 Oct is **October TOIL** that can still be taken this month.

**Unit test matrix** (Vitest; fixed dates; no wall clock):

- **Worked time:**
  - spans of exactly 6:00 and 6:01;
  - a recorded break above and below the minimum;
  - invalid spans: zero, negative, over 24 hours;
  - a night shift.
- **Clock changes:** Sat 28 Mar 2026 22:00 – Sun 29 Mar 06:00 is a 7:00 span;
  Sat 24 Oct 2026 22:00 – Sun 25 Oct 06:00 is 9:00; Sun 25 Oct 2026 00:30–03:30
  is 4:00. Repeat for 28 Mar and 31 Oct 2027, with day flexi and week totals.
- **Day flexi:**
  - today with and without a row;
  - a missing past day;
  - weekend work (target 0);
  - leave, TOIL taken and bank holiday credit up to the target;
  - a worked bank holiday;
  - a terms change on a Monday.
- **Conversion:**
  - the worked example, switch off and on;
  - the preview before settlement vs applied from settlement;
  - a net negative week;
  - all surpluses equal (latest date wins);
  - allocation needing minutes below the target;
  - weekend time added after settlement;
  - a settlement day other than Friday.
- **Months:**
  - the cross-month example;
  - the cap exactly at 7:30 and one minute over;
  - month-end unused TOIL, positive and negative;
  - TOIL taken before it is converted;
  - `asOf` on and after the last day of the month.
- **Paid or unpaid:** allowed off, on, and switched on mid-month (the date
  decides).
- **Edits after settlement:** before and after figures, including a closed month.
- **Leave:** the 7:30 maximum; bank holidays deducted; bought leave; an allowance
  going negative; a leave adjustment.
- **Flexi:** a negative balance; caps unset, then set and crossed; a confirmed
  forfeit.
- **Warnings:** minimums on Mon–Thu vs Fri; band edges at 07:00 and 19:00.
- **Parser and formatter:** `0830`, `830`, `8:30`, `08.30`, `7` → 07:00; `24:00`
  and `25:00` invalid; negative values and totals over 24 hours.

### Data model

Standard columns on every table (UUID v7 `id`, `owner_id`, `created_at`,
`updated_at`, `deleted_at`, `version`), per [DATABASE.md](../DATABASE.md).
Durations are `Int` minutes. **Run database-architect before each migration.**
Uniqueness is on active rows through partial unique indexes in the migration SQL.
One row per date means there is no exclusion constraint and no `btree_gist`. The
service rejects (422) a night shift that runs into the next day's start.

**Core** (`modules/core/`, ADR-0020 §2):

- **`public_holidays`** (`PublicHoliday`): `date date`, `name text`; unique
  active `(owner_id, date)`. Imported from a bundled **England and Wales** list,
  8 a year; there is no runtime network call.

**Tool-owned** (`modules/hours/`):

- **`work_terms`** (`WorkTerm`), effective-dated settings:
  - `effective_from date`, `CHECK` that it is a Monday; unique active
    `(owner_id, effective_from)`;
  - `target_minutes_mon` … `target_minutes_sun int NULL`: the **flexi target**.
    Null means not a working day. Defaults are 450 Mon–Fri and null Sat–Sun, and
    the weekly contract (37:30) is their sum, so it is not stored separately;
  - `min_minutes_mon` … `min_minutes_sun int NULL`: the **warning-only
    minimum**. Defaults are 450 Mon–Thu, 330 Fri and null Sat–Sun, with a
    `CHECK` that each is null where the target is null;
  - `break_threshold_minutes int` (360), `break_minimum_minutes int` (30);
  - `band_start time(0)` (07:00), `band_end time(0)` (19:00),
    `CHECK band_end > band_start`. `time` is new to DATABASE.md's type table;
    database-architect adds it;
  - `paid_overtime_allowed boolean default false`. This replaces the earlier
    "eligible for overtime" toggle; the owner's two toggles are the same concept;
  - `toil_monthly_cap_minutes int` (450);
  - `leave_day_max_minutes int` (450);
  - `flexi_credit_cap_minutes int NULL`, `flexi_debit_cap_minutes int NULL`
    (null, so no cap);
  - `CHECK`s that per-day minutes are within 0–1440 and the three caps within
    0–10080 (a week).
  - The earliest active `effective_from` is the **tracking start**.
- **`work_days`** (`WorkDay`), one per date:
  - `date date`, unique active `(owner_id, date)`;
  - `starts_at timestamptz(3) NULL`, `ends_at timestamptz(3) NULL`, with
    `CHECK` both-or-neither, `ends_at > starts_at`, and at most 24 hours. The
    service checks that `starts_at` falls on `date` in `Europe/London`;
  - `break_minutes int default 0`, `leave_minutes int default 0`,
    `toil_taken_minutes int default 0`, each `CHECK` 0–1440. Rule 4's limits,
    which depend on the terms, are checked in the service;
  - `bank_holiday_worked boolean default false`;
  - no note and no activity (deferred by the owner; a nullable note can be added
    later without a breaking change).
- **`excess_conversions`** (`ExcessConversion`): the weekly switch.
  - `week_start date` (`CHECK` Monday), unique active `(owner_id, week_start)`;
  - an active row means the switch is **on**. Turning it off soft-deletes the
    row; turning it on again creates a new one.
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

Nothing derived is stored. At personal scale (under 400 rows a year) balances are
computed on read; a stored monthly snapshot is added only if a measurement shows
the need. **Migrations:** two additive ones, in slices 4 and 6. A `pg_dump` is
taken before each deploy.

### API

All endpoints are under `/api/v1`, authenticated, with OpenAPI tag `Hours` (or
`Core`), and generated with `pnpm gen:feature <entity> --tool hours` (or
`--core`), then adapted. Ids use `ParseUuidPipe`. Instants are ISO with `Z`,
dates `YYYY-MM-DD`, and durations are integer `…Minutes` fields. Every change is
additive, and `pnpm contract:generate` runs in each API slice.

| Method and path                                             | Purpose                                                                                         | Status codes                                   |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `GET /work-days?from&to&limit&cursor`                       | Days in `[from, to)`, sorted by `date` asc                                                      | 200, 400, 401, 422                             |
| `POST /work-days`                                           | `{ date, startsAt?, endsAt?, breakMinutes, leaveMinutes, toilTakenMinutes, bankHolidayWorked }` | 201, 401, 409 (date exists), 422               |
| `GET/PATCH/DELETE /work-days/:id`, `POST …/:id/restore`     | Read, update with `version`, soft delete, undo                                                  | 200/204, 400, 401, 404, 409, 422               |
| `GET /excess-conversions?from&to`                           | Weeks whose switch is on                                                                        | 200, 401, 422                                  |
| `POST /excess-conversions`                                  | `{ weekStart }`: switch on                                                                      | 201, 401, 409 (already on), 422 (not a Monday) |
| `DELETE /excess-conversions/:id`                            | Switch off                                                                                      | 204, 400, 401, 404                             |
| `GET/POST /work-terms`, `GET/PATCH/DELETE …/:id`            | Effective-dated terms; deleting the last remaining one is refused (422)                         | 200/201/204, 400, 401, 404, 409, 422           |
| `GET/POST /leave-years`, `GET/PATCH …/:id`                  | Allowance and bought leave per year                                                             | as above                                       |
| `GET/POST /time-adjustments`, `…/:id`, `…/:id/restore`      | Opening balances, forfeits, corrections                                                         | as above                                       |
| `GET /time-summaries?from&to&groupBy=day\|week\|month&asOf` | Computed groups (below)                                                                         | 200, 401, 422 (over 366 days, `to` ≤ `from`)   |
| `GET /time-balances?asOf`                                   | Balances (below)                                                                                | 200, 401, 422                                  |
| `GET/POST /public-holidays`, `…/:id`, `…/:id/restore`       | Core: list by range, manual add, delete                                                         | as above                                       |
| `POST /public-holiday-imports`                              | `{ year }`: adds the missing bundled England and Wales dates for that year                      | 200 (nothing new), 201, 401, 422               |

- **`time-summaries` groups** carry:
  - `targetMinutes`, `creditedMinutes`, `workedMinutes`, `leaveMinutes`,
    `bankHolidayMinutes`;
  - `rawFlexiMinutes`, `convertedMinutes`, `flexiMinutes`;
  - `toilMinutes`, `toilTakenMinutes`, `toilUnusedMinutes`;
  - `overtimePaidMinutes`, `overtimeUnpaidMinutes`;
  - `flexiBalanceEndMinutes`;
  - `conversion` (`OFF | PREVIEW | APPLIED`, week groups only);
  - `warnings[]` (codes plus dates).
- **`time-balances`** returns `flexiMinutes`, `toilMonthMinutes`,
  `leaveRemainingMinutes`, `overtimePaidYearMinutes` and
  `overtimeUnpaidYearMinutes`.
- **Ownership** is enforced in the service on every read, update, delete and
  restore; another owner's id gets the same 404.
- **Duplicates:** a second row for a date, or a second active switch for a week,
  returns 409 through the existing `P2002` mapping. The web edits days with
  `PATCH`.
- **The switch** is a single reversible toggle, so it has no restore endpoint:
  switching back on is the undo.
- **Computed read-models** (ADR-0020 §4): the service widens the requested range
  to whole weeks and whole months, loads owner-scoped rows with bounded range
  queries, and calls `@repo/domain` with the caller's `asOf`. There is no `Clock`
  seam.
- **Limits in `@repo/types`:** break ≤ 1440 minutes.

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
┌ Hours ─────────────────────────────────────── ‹ Week of 5 Oct 2026 › [Go to today] ┐ ┌ This week ───────────────────────┐
│ Day        Start  End    Break        Leave  TOIL taken  Worked  Flexi  Converted ⚠ ⋯│ │ Credited 40:30 of 37:30 target   │
│ Mon 5 Oct  08:00  17:30  0:30                             9:00  +0:40   0:50        ⋯│ │ Week flexi +3:00 → 0:00          │
│ Tue 6 Oct  07:30  18:00  0:30                            10:00  +0:40   1:50        ⋯│ │ [on] Convert this week's excess  │
│ Wed 7 Oct  08:00  16:00  0:30                             7:30   0:00               ⋯│ │   TOIL 1:00 · overtime 2:00      │
│ Thu 8 Oct  08:00  17:00  0:15 → 0:30                      8:30  +0:40   0:20        ⋯│ │   (unpaid) · applied Fri 9 Oct   │
│ Fri 9 Oct  08:00  13:30                                   5:30  −2:00               ⋯│ ├ Balances (to today) ─────────────┤
│ Sat 10 Oct —                                                                        ⋯│ │ Flexi          +3:12             │
│ Sun 11 Oct —                                                                        ⋯│ │ TOIL October   7:30 of 7:30      │
└──────────────────────────────────────────────────────────────────────────────────────┘ │ Overtime 2026  2:00 unpaid       │
                                                                                         │ Leave left     120:00            │
                                                                                         └──────────────────────────────────┘
```

- **Layout:** a page header (one `<h1>` "Hours", the week navigator, and "Go to
  today" as the primary action, which focuses today's Start field). Then a CSS
  grid: a full-bleed day table, and a fixed-width aside that stacks below the
  table when the reflow floor is reached.
- **Table:** a real `<table>` with seven day rows and a row header per date.
  - Bank holidays show a badge ("Bank holiday · 7:30 credited").
  - Flexi and Converted columns are right-aligned with tabular numerals.
    Converted appears only when the switch is on, and reads "(preview)" before
    settlement.
  - There is no `role="grid"`: Tab order through ordinary inputs is the keyboard
    model.
- **Rows are small forms.** Tab moves Start → End → Break → Leave → TOIL taken →
  row menu. **Enter saves the row**; **Esc reverts** it. A changed row shows
  "Unsaved" and a Save button, and navigation is blocked while rows are unsaved
  (UX_STANDARDS.md → Forms). Validation runs on blur and save, with errors
  inline.
- **Inputs:** `TimeInput` (a "24-hour, e.g. 08:30" hint via `aria-describedby`,
  parse on blur, an announced "+1 day" tag) and a duration input (`0:30`, `30m`,
  `7.5h` → `h:mm`).
- **Warnings** use a ⚠ icon with text in the row ("Below 5:30 minimum", "Before
  07:00") and a list in the aside. Warnings never block saving.
- **Aside, This week:**
  - credited vs target, and the week's flexi before and after conversion;
  - the **"Convert this week's excess to TOIL and overtime" switch**. It is a
    single reversible toggle, so it saves immediately with a quiet "Saved", as
    UX_STANDARDS.md allows. Switching it back is the undo, so there is no toast;
  - with the switch on, a live summary: TOIL, overtime paid or unpaid, and
    "preview until Fri 9 Oct" or "applied Fri 9 Oct";
  - "Nothing to convert" when the week is net zero or negative.
- **Aside, Balances:** flexi, TOIL this month (with the cap), overtime this year
  (paid and unpaid), and leave remaining.
- **Edits after settlement:** after the save, an info toast (4s) names the
  recalculated week and months (rule 11), and the polite live region in the aside
  announces it.
- **Row menu (⋯)**, mirrored by right-click: Clear day, Mark bank holiday as
  worked. Clear day soft-deletes the row, shows "Day cleared · Undo" for 8
  seconds, and moves focus to the next row. There are no single-key shortcuts.
- **Totals** are computed in the browser with `@repo/domain` from saved data plus
  unsaved rows, then re-read from `time-summaries` and `time-balances` after each
  save.
- **States:**
  - loading: skeleton rows at the final height (after 300ms);
  - no work terms yet: "Set your working terms to start tracking hours", with a
    link to settings;
  - before the tracking start: "Tracking starts on 7 Sep 2026";
  - empty week: seven editable rows plus "No time recorded this week";
  - error: an inline table error with Retry that keeps the header;
  - partial: rows loaded but totals failed, so an error with Retry in the aside
    only;
  - a save failure: a persistent error toast, and the row keeps its input.

**Summary** (`/hours/summary`):

- A page header with presets (This month, Last month, This year, Custom) and
  "Download CSV" as the primary action.
- A table with one row per week or month:
  - target, credited, worked, leave, bank holidays;
  - flexi, converted;
  - TOIL, TOIL taken, TOIL unused;
  - overtime paid and unpaid;
  - flexi balance at the end.
- A totals row, warning badges with text, and a leave-year strip (allowance, used,
  remaining).
- The empty range state reads "No time recorded between these dates".

**Settings** (`/hours/settings`, tab in the URL):

- **Terms:** an explicit-save form for new terms from a Monday:
  - a per-weekday grid with two labelled columns, **Flexi target** ("counts
    towards flexi") and **Minimum** ("warning only"). Clearing a target makes
    the day non-working;
  - break threshold and minimum; the band;
  - **Paid overtime allowed** (off by default, "When off, all overtime is
    recorded as unpaid");
  - the TOIL cap, the maximum leave per day, and flexi caps.
  - Earlier terms are listed read-only, with delete and undo.
- **Leave:** a row per year with the allowance and a bought-leave toggle, and
  used and remaining hours.
- **Balances:** opening flexi, TOIL and leave-used adjustments on the tracking
  start date; confirmed forfeits.
- **Holidays:** a list by year, "Add England and Wales bank holidays for
  <year>", manual add, and delete with undo.

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
  - `@js-temporal/polyfill`, the proposal champions' reference implementation,
    is noticeably larger and slower, and its own documentation has not positioned
    it for production use.
  - Both expose the same `Temporal` API, so switching costs one import.
- **Native Temporal:** Firefox shipped it in 139 (2025) and Chromium in 144
  (early 2026). Node 24 does not have it.
  - `@repo/domain` always imports the polyfill through one module
    (`core/time/temporal.ts`), never `globalThis.Temporal`, so behaviour is
    identical in both apps and in tests.
  - Moving to native is a one-file change. Re-check versions at slice 3.
- **Bundle:** the polyfill and the engine load only in the `/hours` route chunks
  (`autoCodeSplitting`). Slice 3 records the measured chunk size in the PR against
  FRONTEND_QUALITY.md's budgets.

### Export

Backups are not built yet (PRODUCT.md → Next), so export comes early:

- **CSV** (client-side, the shown range): days (date, start, end, break recorded
  and deducted, worked, leave, TOIL taken, credited, flexi, converted, in `h:mm`
  and decimal hours) and, with the summary slice, week and month rows. It uses a
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
    Switch, `TimeInput` and duration input primitives;
  - the template's restore endpoint and transaction-capable repositories;
  - the generator's `--tool`/`--core` flags;
  - `packages/domain`.
- **Not built here:** the command palette (PRODUCT.md → Later); the app shell's
  token retune (PRODUCT.md → Next; slice 1 takes only the sidebar and content
  width); `DataTable`.
- **Deployment:** building does not wait for login hardening or backups, but
  WorkHub stays off the internet until they exist.

## Slices

**Build order.** Build the slices in this order: one branch and one PR per
slice (`feat/hours-<slice>`, or `chore/`/`docs/` where that fits), each shipped
with `/ship`. Every PR leaves `main` releasable and ships its tests. Update
_As-built notes_ and PRODUCT.md's Now line (slice _n_ of 10) as each lands.

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
   `core/time` on `temporal-polyfill`, `hours/` rules 1–14 with levelling, the
   before/after diff for rule 11, the parser and formatter. Tests: the full unit
   matrix, including both worked examples. Reviews: security-reviewer (new
   dependency).
4. **Settings API:** `work-terms`, `leave-years`, `time-adjustments`, and core
   `public-holidays` with the bundled England and Wales import; migration 1.
   Tests: API e2e for every status code, ownership 404, 409 version and
   duplicate, 422 rules (non-Monday, minimum without target, last terms, import
   year). Reviews: database-architect first. Split holidays into their own PR if
   the diff is large.
5. **Settings UI:** four tabs (the targets and minimums grid, paid overtime
   allowed, leave year, balances, holidays); the Tabs, Toast, DropdownMenu and
   Switch primitives; `TimeInput` and the duration input. Tests: component tests
   for the inputs and forms; Playwright + axe for setting terms, bought leave, a
   holidays import, and undo.
6. **Work days and excess conversions API:** `work-days` and
   `excess-conversions`; migration 2. Tests: API e2e for CRUD and restore;
   duplicate date and duplicate switch 409; night-shift collision 422;
   BST-night instants; rule 4's limits 422; non-Monday 422; ownership.
7. **Week view:** `/hours?week`, the seven day-row forms, live worked and day
   flexi, warnings, Clear day with undo, and the Hours manifest in the sidebar.
   Tests: a keyboard-only Playwright journey (enter a week, a night shift, leave,
   undo) with axe at 1280 and 400% zoom.
8. **Export:** CSV of days for the shown range, and `pnpm data:export`. Tests:
   CSV builder unit tests; a CLI test against the `_test` database. Reviews:
   security-reviewer.
9. **Summaries and balances API:** `time-summaries` and `time-balances` on
   `@repo/domain`. Tests: API e2e for range 422; week and month grouping; the
   cross-month example; the TOIL cap; month-end conversion; paid/unpaid by
   effective date; preview vs applied by `asOf`; ownership (another owner's rows
   never counted).
10. **Aside and summary view:** the This week and Balances panels, the conversion
    switch with its preview and applied states, the recalculation toast,
    `/hours/summary` with URL range, and summary CSV. Tests: Playwright + axe for
    switching conversion on and off, an edit after settlement, and reading the
    summary; browser totals equal API totals for the seeded worked-example week.

**Recorded at approval (2026-09-16):** PRODUCT.md's purpose, glossary, Now and
feature inventory, ADR-0020 Accepted, and the one-line purpose in CLAUDE.md §1.

- **When slice 10 lands:** Status → Shipped, the feature inventory, as-built
  notes.

## Decisions & open questions

### Answered by the owner (2026-09-16, first round)

1. **Contracted time.** "i work 37.5hrs per week (mon to fri) but the hours can
   vary per day. Would say a minimum of 5.5hrs on a friday and minimum of 7.5hrs
   mon to thur". The minimums only warn; hours, working days and minimums are
   effective-dated settings. The daily flexi target is refined in round 2,
   answer 4.
2. **Extra time.** "time goes to flex balance and can go negative. time only
   counts as overtime when marked. there should be a setting that lets the user
   toggle if they are eligible for overtime or not. if they are not eligible
   then it goes to unpaid overtime.. maximum amount of toil is 7.5hrs a month and
   it must be taken in the same month. only toil accrued and not used in the same
   month does not roll over and is then converted to overtime (paid or unpaid
   depending on eligibility and permission)". Built as rules 5–10.
3. **Overtime reward:** TOIL or overtime, hour for hour, in hours only (no
   money).
4. **Allocation to days.** "calculation runs to calculate overtime / toil over
   the week and then assigns it to days based on best place to average hours".
   Built as the levelling rule (rule 6).
5. **TOIL cap:** TOIL over 7:30 in a calendar month, and TOIL unused at month
   end, become overtime (rules 7–8).
6. **Breaks:** record actual breaks; spans over 6:00 have at least 0:30
   deducted; the threshold and minimum are settings.
7. **Period:** calendar month.
8. **Caps and carry-over:** flexi caps are settings, unset by default; a warning
   when crossed; a forfeit only on confirmation.
9. **Leave.** "leave is based on hours with no minimum per day. max leave per day
   is 7.5hrs. current leave allowance is 247.5hrs per year jan to dec. and this
   includes the uk bank holiday (i.e. 25 x 7.5hrs core + 8 x 7.5hr bank holidays.
   there is an option to purchase an additional 5 \* 7.5hrs day leave a year".
   Bought leave is a per-year toggle adding 37:30.
10. **Working band:** warn outside it; default 07:00–19:00, editable.
11. **Recording:** one start, end and break per day (`work_days`, one row per
    date).
12. **Activity:** none for now ("leave what time was spent on for now"); notes
    are dropped too.
13. **Architecture:** ADR-0020 approved as drafted; Accepted at final
    approval.
14. **Calculation engine:** "Shared package on Temporal": `@repo/domain` on
    `temporal-polyfill`.

### Answered by the owner (2026-09-16, second round)

1. **How a week's extra time becomes TOIL or overtime: "One toggle per week".**
   With the switch on, all of the week's net excess at settlement becomes TOIL
   up to the monthly cap, and the rest becomes overtime, spread over days by
   levelling. With it off, the week stays as flexi. This replaces per-week minute
   claims, so there is no claim to clamp: a later edit simply recomputes the
   excess (rules 6 and 11).
2. **Permission for paid overtime.** "toggle again. i.e. i'm currently not
   contractually allowed paid overtime but this might change in the future".
   Modelled as the effective-dated `paidOvertimeAllowed` in work terms, off by
   default and merged with the earlier eligibility toggle, because both decide
   the same thing: paid or unpaid. Per-month approvals are removed (rule 9).
3. **Bank holidays:** England and Wales (8 a year), bundled, deducted from the
   leave allowance at 7:30 each.
4. **When flexi counts: "Day by day".** Each working day accrues credited time
   minus a 7:30 target (37:30 a week). The 5:30 Friday minimum stays a separate,
   warning-only setting. The week settles on its last working day, where the
   switch applies (rules 5–6).

### Answered by the owner (2026-09-16, third round) and approval

1. **TOIL in a week that spans two months: "The day it's allocated to".** TOIL
   belongs to the month of the day it is placed on. TOIL placed on days in a
   month that has already closed becomes overtime immediately, as in the
   cross-month example (rules 7–8).
2. **Approval:** the owner approved this plan and ADR-0020 on 2026-09-16 ("Approve
   — start building"). Status is **Approved**; ADR-0020 is **Accepted**.

### Open questions

None.

### Stated defaults (not asked; change on request)

- Terms take effect from a Monday; the tracking start is the first terms' date.
- A night shift counts wholly to its row's date.
- Leave, TOIL taken and bank holiday credit are only on working days, and
  together are at most that day's target.
- Levelling tie-break: the latest date first.
- TOIL taken but not earned by month end becomes a flexi debit, with a warning.
- Today counts towards flexi only once it has a row.
- Exact minutes, no rounding; `h:mm` display.

## As-built notes

### Slice 1: tool registry and sidebar

- **Registry:** `ToolManifest` and `ToolCommand` are in
  `apps/web/src/lib/tool-manifest.ts` (a shared layer, so features can import
  the type). `path` is a typed router path. A command is `{ id, label }` only
  until the palette decides how commands run. `app/tools.ts` lists Home only;
  Home belongs to no tool, so its manifest is declared there, not under
  `features/`.
- **Sidebar:** `components/layout/sidebar.tsx`, a labelled `<nav>` ("Tools")
  with a link per manifest. The current tool has `aria-current="page"` (the
  router's default matching covers sub-pages and search params, and matches `/`
  exactly), plus a surface, a 500 weight and a marker bar. In the rail the label
  stays as the link's accessible name (`sr-only`), and a tooltip shows it on
  hover and focus. The tooltip is controlled and opens only in the rail state,
  so an expanded link never gets an `aria-describedby`. The header toggle is
  named "Sidebar", with `aria-expanded` and `aria-controls` on the `<nav>`.
- **State:** `lib/preferences.ts` stores `workhub:sidebar` as
  `{ version: 1, value: { collapsed } }`. The inline script in `index.html` sets
  `data-sidebar` on `<html>` before first paint; the `sidebar-rail:` CSS variant
  in `globals.css` applies it. `src/pre-paint-script.test.ts` keeps the script's key and
  version in step with the helper.
- **Reflow (decided while building):** below 48rem the sidebar is always the
  rail and the header toggle is hidden. The header wraps and stops sticking, the
  account email is shown at every width, and long words in the page wrap. Checked
  at 320×200 CSS px.
- **Focus after navigation (review fix):** `lib/route-focus.ts`, subscribed in
  the root route, moves focus to `<main>` (or the first heading on a public
  page) when a navigation changes the pathname. It does nothing on the initial
  load or on search-param-only changes, which matters for slice 7's `?week=`.
- **Shell:** a skip link to `<main>`, `scroll-padding-top` for the sticky header
  (2.4.11; it assumes a one-line header at 48rem and wider), and content up to `--width-page` instead of the old 1024px cap. The home
  page caps itself at `--width-prose`.
- **Tokens:** `--header-height`, `--sidebar-width`, `--sidebar-rail`,
  `--width-prose`, `--width-page`, `--z-header` and `--z-popover`. No density or
  motion tokens: the sidebar does not animate.
- **New dependency:** `@radix-ui/react-tooltip`, wrapped as
  `components/ui/tooltip.tsx`, with one `TooltipProvider` in `AppShell`, so Radix loads with the signed-in
  route chunk, not on the sign-in page. Measured with `pnpm build`: initial JS
  91.2 kB gzipped, and the `_authed` layout chunk 20.3 kB gzipped (within
  FRONTEND_QUALITY.md's advisory budgets).
- **Tests:** `app/tools.test.ts`, `lib/preferences.test.ts`,
  `lib/route-focus.test.tsx`, `src/pre-paint-script.test.ts`,
  `components/ui/tooltip.test.tsx`, `components/layout/app-shell.test.tsx`, and
  `e2e/app-shell.spec.ts`. That spec covers 1280×800 and 1920×1080 (expanded,
  rail with tooltips, persistence including the pre-paint script alone, keyboard
  use, axe in light and dark) and reflow at 320×200.

### Slice 2: template and generator groundwork

- **Restore:** the template has `POST /:id/restore` → 200 with the row and a
  new `version`. It is idempotent: an active row comes back unchanged, so a
  double undo is harmless. A missing or another owner's row is the usual 404,
  and an active row holding the same unique key is a 409 from the partial unique
  index (`P2002`). A restore that loses a race to a concurrent one returns the
  row too. The repository's `findById` is the one read that skips `active()`,
  so every 404 case costs the same single read (security review).
- **Transactions:** every template repository method takes an optional
  `db: Prisma.TransactionClient = this.prisma`. The template's own use cases
  are single writes, so its service opens no transaction.
- **Generator:** `pnpm gen:feature <entity> --tool <tool>` or `--core`; with
  neither it refuses, and `core` is reserved as a tool id. It writes
  `modules/<group>/<plural>/` (shared imports get one more `../`), sets the
  OpenAPI tag to the group's name (`Hours`, `Core`), places the model under
  `// === Tool: <tool> ===` or `// === Core ===` (core before the first tool),
  and adds the entity module to `<Group>Module`, creating the group and
  registering it in `AppModule` on first use. `CoreModule` also exports its
  entity modules. The e2e test stays flat in `apps/api/test/`.
- **Found while building:** renaming can reorder imports alphabetically, so a
  generated controller could fail `import/order` depending on the entity name
  (`sample-widget` passed by luck; `work-day` did not). The generator now runs
  `prisma generate` and then `eslint --fix` on what it wrote.
- **Found in CI:** every generated e2e suite used the same two hard-coded user
  ids. Vitest runs e2e files in parallel, and one suite's cleanup deleted the
  users (cascading) while another was creating rows, so a create failed its
  foreign key. The template now uses `randomUUID()` users per suite and scopes
  its table cleanup to them (a BACKLOG item, now done).
- **verify-template** generates `sample-widget --tool sample-kit` (a new tool)
  and `sample-gadget --core`, and restores any real `core.module.ts` it
  touched, so it keeps working once core has real modules (slice 4).
- **Docs:** REFERENCE_FEATURE, BACKEND_ARCHITECTURE (new _Tools and core_
  section), FRONTEND_ARCHITECTURE (the `features/core` exception and undo via
  restore), API.md (restore, app-wide names, computed read-models), DATABASE.md
  and ARCHITECTURE.md; two BACKLOG items removed.
- **For slice 6 (backend review):** the template has no unique key besides
  `id`, so no test reaches restore's 409. `work_days`' restore e2e adds that
  case, proving `P2002` → 409 fires from restore's `updateMany`.

### Slice 3: calculation engine

- **Package:** `packages/domain` (`@repo/domain`), ESM like `@repo/types`: built
  by `tsc`, linted with the base config, tested with Vitest, and picked up by
  Turborepo's `build`, `lint`, `typecheck` and `test`. Neither app depends on it
  yet; the web takes it in slice 7 and the API in slice 9 (each adds
  `packages/domain/package.json` to its Dockerfile's `deps` stage then).
- **Temporal:** `temporal-polyfill` 1.0.5 (MIT), imported only in
  `core/time/temporal.ts`. Node 24.21 still has no native Temporal.
- **API:** `calculateHours(input, { until })` returns per-day, per-week,
  per-month and per-leave-year results from the tracking start, always covering
  whole weeks, whole months and the whole leave year. `summarise(result, from,
to, groupBy)` and `balancesAt(result, asOf)` shape them for `time-summaries`
  and `time-balances`; `recalculation(before, after, weekStart)` is rule 11.
  The parser and formatter are `parseTimeOfDay`, `parseDuration`,
  `formatDuration`, `formatSignedDuration`, `formatFlexi` and `decimalHours`.
  `shiftInstants(date, start, end)` turns typed times into instants (an end at
  or before the start is the next day).
- **Decided while building:**
  - **Minimum warning** compares _credited_ time, not worked time, so leave,
    TOIL and bank holiday days don't warn (rule 13 above updated).
  - **Leave counts when booked:** future leave and future bank holidays in the
    year are in "used". A `LEAVE` adjustment adds to what remains (negative for
    leave used before tracking started).
  - **Adjustments dated before the tracking start** take effect on it. `TOIL`
    adjustments count towards the month's cap but never overflow into
    overtime.
  - **Preview split:** a preview walks the TOIL cap after the month's applied
    minutes. A preview day in a month that ends before its week settles
    previews as overtime (rule 8 will convert it at settlement).
  - **A week with no working day** has no settlement date and never applies.
  - **`INVALID_SPAN`:** a row whose times are incomplete, malformed (not a
    `…Z` instant), not after the start, or over 24 hours counts no worked time
    and warns. The API rejects such rows with a 422, so this is defensive.
  - **Rows that later terms make invalid** (test and security reviews): a
    terms change or deletion can leave saved leave or TOIL taken on a day that
    is now non-working, or over its new target. Such a day warns
    `TIME_OFF_OVER_TARGET`, and its time off credits at most the target
    (nothing on a non-working day), so it can never create excess that
    levelling would take from on-target days. The recorded leave still counts
    against the allowance.
  - **Input bounds** (security review): every date must be a real
    `YYYY-MM-DD` in 2000–2100, or `calculateHours` throws `HoursInputError`
    before doing any work. That bounds the range (a year-1000 tracking start
    had taken 34 s), and the fast date helpers are only correct for
    four-digit years. The leave-year pass is linear. Slice 9's DTOs must keep
    the same bounds and never send `HoursInputError`'s message to a client.
  - **Durations:** a bare number is hours (`7.5` → 7:30); `30m` is minutes.
- **Performance:** a warm recalculation over three years with every week
  converting takes about 13 ms (Node 24), input checks included. Three changes got it there from
  131 ms: the hot date helpers use integer day numbers instead of Temporal
  parsing; `minutesBetween` uses `Date.parse`; and the London conversion of
  each instant is memoised (bounded at 10,000), because the web recalculates the
  same saved rows on every keystroke. The first run costs about 80 ms, so slice 7
  runs it when the week's data loads, never first on a keypress (the long-task
  budget is 50 ms).
- **Bundle:** the engine plus the polyfill is 24.3 kB gzipped (esbuild,
  minified), within FRONTEND_QUALITY.md's advisory route-chunk budget. It loads
  only in the `/hours` chunks from slice 7.
- **Tests:** 104 in `packages/domain`: both worked examples, switch off and on,
  the cross-month preview and settlement, rule 11's diff, clock changes in 2026
  and 2027 (day flexi and week totals for all four), the TOIL cap at 7:30 and one minute over, month-end unused and
  overdrawn TOIL, paid overtime switched on mid-month, leave, flexi caps and
  forfeits and caps reached but not crossed, bank holiday credit capped below a
  larger target, warnings at the band edges, the review regressions, and the
  parser and formatter.

### Slice 4: settings API

- **Endpoints:** `work-terms` (CRUD and restore), `leave-years` (create, list,
  get and update only: a year is edited, never deleted), `time-adjustments`
  (CRUD and restore, with `from`/`to` and `balance` filters), and core
  `public-holidays` (CRUD and restore, `from`/`to`, earliest first) plus
  `POST /public-holiday-imports`. All are tagged `Hours` or `Core`.
- **Migration 1** (`add_hours_settings`, designed by database-architect):
  four additive tables. Every `CHECK` and partial unique index is in the SQL and
  listed in a comment on its model. Bounds: per-day minutes 0–1440; the TOIL
  and flexi caps 0–10080; the leave allowance 0–100,000 and adjustments
  ±100,000 (never 0); years 2000–2100; holiday names 1–100 characters. The
  same bounds are in `@repo/types` (`hours.ts`) for the web forms.
- **Work terms:**
  - The body nests `targetMinutes` and `minimumMinutes` by weekday (`mon` …
    `sun`, every key present, `null` for "not set"), matching the engine's
    `Weekdays`. The band is `HH:MM`; `common/dates.ts` converts `date` and
    `time(0)` columns in UTC, so BST never shifts them (an e2e test checks).
  - Omitted fields take the owner's defaults. When targets are sent without
    minimums, each minimum is cleared on a day that stops being a working day
    and lowered to its target, so a targets-only change never fails.
  - **Decided while building** (database-architect's open questions): a
    minimum may not exceed its target, and a target must be at least 1 minute
    (clear it to make a day non-working). Both are 422s in the service, not
    `CHECK`s. A break minimum above the threshold is allowed.
  - `effectiveFrom` cannot be changed by `PATCH`: add terms from the new Monday
    instead.
- **Holidays:** `england-and-wales.ts` bundles GOV.UK's published list for
  2019–2028 verbatim (fetched 2026-09-23, one-off holidays included) and
  computes 2029–2040 from the standing rules. A test proves the rules reproduce
  every ordinary published year and 2022's Christmas substitutes. A yearly
  refresh is in PROCESS.md → Maintenance. The import adds the year's dates the
  owner has no active holiday on, in one `createManyAndReturn`: 201 with the
  rows added, or 200 with none. A deleted holiday is re-added by the next
  import. `PublicHolidaysModule` exports its service for slice 9.
- **Security review fixes** (all reproduced over HTTP first):
  - `null` on a non-nullable field, `targetMinutes: []` (which had passed
    `ValidateNested` and wiped the stored minimums), `version` over INT4, and a
    NUL byte in a holiday name each reached Prisma. All are 422s now, through
    `IsOmittable()`, `PartialType(…, { skipNullProperties: false })`,
    `@IsObject()`, `@Max` on `version`, and `NO_CONTROL_CHARACTERS_PATTERN` in
    `@repo/types`. The reference template has the same fixes.
  - A list cursor that is another owner's id returned rows where a missing id
    returned none. Every repository (and the template) now checks that the
    cursor is one of the caller's active rows first.
  - Concurrent imports of a year now both succeed and add each date once
    (`createManyAndReturn` with `skipDuplicates`).
  - Deleting terms locks the owner's active terms (`SELECT … FOR UPDATE`) in a
    transaction, so two racing deletes cannot remove the last one.
- **Tests:** unit tests for the terms rules, leave years and the import;
  e2e suites for all four resources and the import (43 tests): every status
  code, the review's regressions (nulls, the array body, the version overflow,
  control characters, the foreign cursor, and both races), ownership 404s on every route, duplicate and stale-version 409s,
  restore into a taken key (409, the case slice 2 deferred to here), and the
  422 rules.

### Slice 6: work days and excess conversions API

- **Endpoints:** `work-days` (CRUD and restore, `from`/`to` in date order) and
  `excess-conversions` (list, `POST` to switch a week on, `DELETE` to switch it
  off; no get, update or restore, because switching on again is the undo).
- **Migration 2** (`add_hours_work_days`, database-architect): two additive
  tables with `CHECK`s for paired times, order, the 24-hour span, per-day
  minute bounds, a 2000–2100 date window and an ISO Monday, plus partial
  unique indexes on `(owner_id, date)` and `(owner_id, week_start)`.
- **The API now depends on `@repo/domain`** (planned for slice 9): the day
  rules use its `localDateOf`, `minutesBetween`, `addDays` and `isIsoInstant`.
  `apps/api/Dockerfile` copies `packages/domain/package.json` into its install
  stage. Node 24 `require`s the ESM package directly, as it does `@repo/types`.
- **Day rules** (`work-day-rules.ts`, unit-tested; 422 with every problem in
  `details`):
  - terms must be in force (`WorkTermsService.findInForce`, exported to the
    tool's other modules);
  - times both or neither, strict `…Z` instants, the end after the start and
    within 24 hours, the start on `date` in Europe/London, and the break less
    than the span. **Decided while building:** a break needs times;
  - a night shift may not run into the next day's start, and a start may not
    be before the previous day's end;
  - rule 4: leave at most the maximum per day; leave and TOIL taken only on
    working days and, with any bank holiday credit, at most the target. So
    leave on an unworked bank holiday is refused. `bankHolidayWorked` is only
    for a bank holiday (`PublicHolidaysService.isHoliday`, core, exported).
- **Restore re-checks the rules**, since the neighbouring days or the terms
  may have changed since the day was cleared.
- **Tests:** unit tests for every rule and the switch; e2e (17 tests) for
  CRUD, restore and the restore-into-a-re-entered-date 409, duplicate date and
  duplicate switch 409s, the tracking-start, time, BST-night and night-shift
  collision 422s (both ways round, and on restore), rule 4's limits with an
  imported bank holiday, the non-Monday 422, and ownership on every route.

### Slice 9: summaries and balances API

- **Endpoints:** `GET /time-summaries?from&to&groupBy&asOf` and
  `GET /time-balances?asOf`, in `modules/hours/time-summaries/`: no table and
  no repository. `HoursCalculationService` loads the caller's rows from the
  tracking start through each hours module's exported
  `listForCalculation` (owner-scoped, date-bounded, unpaginated) and core's
  `PublicHolidaysService`, maps them with `to-engine.ts`, and runs
  `calculateHours`. The controllers stay thin.
- **Decided while building:**
  - **`asOf` is required** on both endpoints: the caller's today in
    Europe/London. The API has no clock (ADR-0020 §4), and the web knows the
    owner's today.
  - **Ranges widen to whole groups** (a week from its Monday, a month from its
    1st), and each group carries `start` and `end`. `groupBy` defaults to
    `week`. The 366-day limit and `to` after `from` are checked before
    widening.
  - **Week groups also carry the conversion's detail** for slice 10's aside:
    `settlementDate`, `excessMinutes`, and `conversionToilMinutes` and
    `conversionOvertimePaid/UnpaidMinutes` (preview or applied).
  - **Balances also return** `trackingStart`, `toilTakenMonthMinutes`,
    `toilCapMinutes`, and the leave year's `leaveAllowanceMinutes` and
    `leaveUsedMinutes` for the leave strip.
  - A computed list is documented with the new `ApiDataListResponse`.
- **Review fix** (security and backend reviews): widening the last partial
  week of 2100 asked the engine for a date in 2101, and its guard threw a 500.
  The horizon is now capped at the engine's last date, and any
  `HoursInputError` becomes a fixed-message 422.
- **Tests:** e2e (8): the range 422s and a missing `asOf`; the 2000 and 2100
  window edges; no terms; the
  cross-month example as a preview (asOf 1 Oct) and applied (asOf 2 Oct) by
  week, month and balances; widening a partial range; the TOIL cap with paid
  overtime switched on from a later Monday; and another owner's rows never
  counted.

### Slice 8: export

- **`pnpm data:export --email <owner> [--out <file>] [--force]`**
  (`apps/api/src/cli/data-export.ts`, documented in DATABASE.md → Data
  export): every owned table as JSON in the API's wire shapes, soft-deleted
  rows included, from one `REPEATABLE READ` snapshot. The file is mode 0600,
  and an existing one is never overwritten without `--force`. A unit test
  fails if a model with an `ownerId` is missing from `EXPORTED_TABLES`.
  `cli/bootstrap.ts` gains `runWithApp` for commands that need providers
  rather than Better Auth.
- **CSV in `@repo/domain`**, not the web folder, so it is pure, unit-tested and
  shared:
  - `toCsv` (`core/csv.ts`) writes RFC 4180 with CRLF and a UTF-8 BOM, so Excel
    reads the true minus sign. It has the formula-injection guard: text
    starting with `=`, `+`, `-`, `@`, a tab or a carriage return gets a `'`
    prefix, and numbers are never prefixed;
  - `daysCsvRows` (`hours/csv.ts`) builds one row per recorded or credited day
    in `[from, to)`: London `HH:MM` start and end, "Ends next day", and every
    duration in `h:mm` and decimal hours.
- **Security review fixes:** `--force` over an existing world-readable file
  kept its old mode, and a dangling symlink was followed. The file is now
  created exclusively (`wx`, 0600), or written to a temporary file and
  renamed when forced. The default name no longer carries the email, export
  files are gitignored, and the production steps use `wh` and remove the
  container copy. The CSV guard also covers a leading line feed and
  full-width `＝＋－＠`, and quotes `;` for semicolon-separated readers.
- **Decided while building:** the week view's "Download CSV" is wired in slice
  7 with the view itself; this slice ships the builder and the CLI.
- **Tests:** `export.spec.ts` (the table registry); an e2e test against the
  `_test` database (only the owner's rows, soft-deleted rows kept, wire
  shapes, an unknown email refused); domain tests for quoting, the injection
  guard, numbers, and the day rows (a night shift, a raised break, a negative
  flexi).
