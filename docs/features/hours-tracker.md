# Hours tracker

- **Status:** Shipped (2026-09-23). Approved 2026-09-16; all ten
  [slices](#slices) built.
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
  spread over the days by levelling in whole blocks (0:30 by default); minutes
  short of a block stay as flexi;
- see unused TOIL convert to overtime at month end. Overtime is paid only while
  paid overtime is allowed in the settings;
- record leave in hours against a 247:30 yearly allowance, with England and
  Wales bank holidays deducted;
- get warnings for short days, time outside the working band, and caps;
- review weekly and monthly summaries, and export the data.

## Glossary

Use these terms in code, UI copy and docs (they move to PRODUCT.md's glossary
on approval). Every duration is whole minutes.

| Term                  | Meaning                                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Work day**          | One row for a date: an optional start and end, break, leave, TOIL taken, and whether a bank holiday was worked.                                                     |
| **Worked time**       | The span from start to end, minus the deducted break (rule 3).                                                                                                      |
| **Credited time**     | Worked time + leave + TOIL taken + bank holiday credit.                                                                                                             |
| **Daily target**      | The time a working day is expected to credit for flexi: 7:30 Mon–Fri. It drives the maths.                                                                          |
| **Daily minimum**     | The least time the owner should work on a day: 7:30 Mon–Thu, 5:30 Fri. It raises a warning only and never changes a number.                                         |
| **Day flexi**         | Credited time minus the daily target (the target is 0 on a non-working day), less any minutes converted on that day.                                                |
| **Settlement day**    | The last working day of a week (Friday by default). The week's conversion applies from then.                                                                        |
| **Excess conversion** | The owner's per-week switch. When on, whole blocks (default 0:30) of the week's net positive flexi at settlement become TOIL and overtime; the rest stays as flexi. |
| **TOIL**              | Converted time to be taken off in the same calendar month; at most 7:30 a month.                                                                                    |
| **Overtime**          | Converted time over the TOIL cap, or TOIL unused at month end. **Paid** if paid overtime is allowed on that date, else **unpaid**.                                  |
| **Work terms**        | Effective-dated settings: targets, minimums, break rule, band, paid overtime allowed, caps, the conversion block, maximum leave per day.                            |
| **Leave year**        | 1 January to 31 December, with an allowance in hours (247:30, plus 37:30 bought leave when chosen).                                                                 |
| **Time adjustment**   | A signed, dated correction: an opening balance, a confirmed flexi forfeit, a correction.                                                                            |

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
      and then overtime, in whole conversion blocks (0:30 by default); the rest
      stays as flexi. It is spread over days by the
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
   - If it is **on** and `asOf` is on or after the settlement day, the
     **convertible** minutes are the largest whole number of **conversion
     blocks** (a work terms setting, default 0:30) in E. They are allocated to
     days by [levelling](#rule-6-allocating-a-weeks-excess-to-days). Each
     day's **day flexi** = raw − allocated minutes, and the allocated minutes
     on that date become **converted minutes**.
   - The rest of E (less than one block) is not converted: it **stays as
     flexi** on the days, because raw flexi is unchanged and only allocated
     minutes are subtracted. With E = 2:45, 2:30 converts and 0:15 stays in the
     flexi balance.
   - A week with a net zero or negative total has E = 0, so nothing is
     allocated. The switch stays on and the week shows "Nothing to convert".
     A week whose E is more than 0 but under one block converts nothing and
     shows "Less than one block (0:30) to convert"; E stays as flexi.
   - Before settlement, the conversion is only a **preview** and changes no
     balance.
   - Weekend time entered after settlement joins the same week and recomputes
     E (rule 11).
7. **TOIL cap by allocation date.** For each calendar month, walk its days in
   date order and add up converted minutes as TOIL until the month's TOIL
   reaches the cap (default 7:30). Converted minutes beyond the cap become
   **overtime** on their date. The cap is a balance rule, so a day's TOIL and
   overtime can split in the middle of a block (with 7:15 already converted,
   a 0:30 block is 0:15 TOIL and 0:15 overtime). In a week that spans two months, each day's
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
the days furthest above their target, levelling them down together, in the
whole blocks the owner's timesheet takes.

> **Changed on 2026-09-23 at the owner's request:** "i have to input my time
> sheet in 30min blocks so leveling to 0:23 isn't correct". Levelling now
> moves whole **conversion blocks** (default 0:30, an effective-dated work
> terms setting), and the minutes short of a block stay as flexi. It used to
> move single minutes.

1. The block B is the conversion block in the week's terms (terms never change
   mid-week). The **convertible** minutes are the largest whole number of
   blocks ≤ min(E, the week's worked minutes).
2. For each counted day in the week with worked time, **surplus** = worked −
   target (target 0 on a non-working day).
3. **Take one block at a time** from the day with the **largest remaining
   surplus**. On a tie, take from the **latest date**.
4. A day never gives more than its worked minutes, so a block comes only from
   a day with at least a block of worked minutes left. If no day can give a
   whole block, stop. A surplus may go below zero if that is where the level
   falls.
5. Stop when the convertible minutes are allocated. Every day's converted
   minutes are a multiple of B.
6. The rest, E − converted, stays as flexi on the days (it is never
   allocated).

Previews use the same rule. With B = 1 minute this is the original
minute-by-minute levelling, the same as levelling the highest days down to a
common line.

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

**Same week, switch on.** Settlement is Fri 9 Oct, and E = **3:00**: six 0:30
blocks, so all of it converts. Surpluses are Mon 1:30, Tue 2:30, Wed 0:00,
Thu 1:00, Fri −2:00. One block at a time, from the largest remaining surplus,
latest date first on a tie:

1. Tue (2:30 → 2:00);
2. Tue (2:00 → 1:30);
3. Tue (tie with Mon at 1:30; Tue is later → 1:00);
4. Mon (1:30 → 1:00);
5. Thu (Mon, Tue and Thu tie at 1:00; Thu is latest → 0:30);
6. Tue (Mon and Tue tie at 1:00; Tue is later → 0:30).

| Day   | Raw flexi | Converted | Day flexi | Month-to-date TOIL²  | TOIL | Overtime (unpaid) |
| ----- | --------- | --------- | --------- | -------------------- | ---- | ----------------- |
| Mon 5 | +1:30     | 0:30      | +1:00     | 6:30 → 7:00          | 0:30 | —                 |
| Tue 6 | +2:30     | 2:00      | +0:30     | 7:00 → 7:30 (capped) | 0:30 | 1:30              |
| Wed 7 | 0:00      | —         | 0:00      | 7:30                 | —    | —                 |
| Thu 8 | +1:00     | 0:30      | +0:30     | 7:30 (capped)        | —    | 0:30              |
| Fri 9 | −2:00     | —         | −2:00     | 7:30                 | —    | —                 |

² Assumes 6:30 of TOIL was already converted on 1–2 October.

- The week's flexi is now 0:00, and 3:00 was converted: **1:00 TOIL and 2:00
  overtime**.
- **With a remainder:** had Friday been 5:15 (E = 2:45), five blocks (2:30)
  would convert (Tue, Tue, Tue, Mon, Thu: Mon 0:30, Tue 1:30, Thu 0:30), and
  **0:15 stays as flexi**.
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

- E = 3:00, six 0:30 blocks: Mon, Mon, Thu (tie at 1:00, latest), Mon, Thu
  (tie at 0:30, latest), Mon. Mon gives 2:00 and Thu 1:00, as minute-by-minute
  levelling would, because both surpluses are whole blocks.
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
  - the worked example, switch off and on (0:30 blocks);
  - the preview before settlement vs applied from settlement, both in blocks;
  - a net negative week;
  - all surpluses equal (latest date wins), and E one minute short of whole
    blocks (the earliest day gives one block less; the rest stays as flexi);
  - allocation needing minutes below the target;
  - a remainder: E = 2:45 converts 2:30 and 0:15 stays as flexi;
  - a 0:15 and a 1:00 block; E under one block (nothing converts); a block
    larger than E;
  - converted minutes per day always a multiple of the block, and a block
    taken only from a day with a whole block of worked time left;
  - weekend time added after settlement;
  - a settlement day other than Friday.
- **Months:**
  - the cross-month example;
  - the cap exactly at 7:30 and one minute over (mid-block);
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
  - `conversion_block_minutes int` (30), `CHECK` 1–480: conversion turns
    whole blocks into TOIL and overtime (rule 6; added 2026-09-23);
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
the need. **Migrations:** two additive ones, in slices 4 and 6, and a third,
`add_conversion_block`, for the 2026-09-23 change. A `pg_dump` is
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
│ Mon 5 Oct  08:00  17:30  0:30                             9:00  +1:00   0:30        ⋯│ │ Week flexi +3:00 → 0:00          │
│ Tue 6 Oct  07:30  18:00  0:30                            10:00  +0:30   2:00        ⋯│ │ [on] Convert this week's excess  │
│ Wed 7 Oct  08:00  16:00  0:30                             7:30   0:00               ⋯│ │   TOIL 1:00 · overtime 2:00      │
│ Thu 8 Oct  08:00  17:00  0:15 → 0:30                      8:30  +0:30   0:30        ⋯│ │   (unpaid) · applied Fri 9 Oct   │
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
  - "Nothing to convert" when the week is net zero or negative; "Less than one
    block (0:30) to convert" when E is under a block; and, when E is not a
    whole number of blocks, the remainder ("0:15 stays as flexi").
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
  - the TOIL cap, the **conversion block** ("Conversion turns whole blocks
    into TOIL and overtime; the rest stays as flexi. Default 0:30."), the
    maximum leave per day, and flexi caps.
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

### Slice 5: settings UI

- **Route:** `/hours/settings?tab=terms|leave|balances|holidays&year=YYYY`
  (`routes/_authed/hours/settings.tsx`). An unknown tab or year falls back to
  the default (terms; this year in London) instead of failing. **`year` was
  added while building:** the Holidays tab lists one year at a time, and the
  year shown is view state, so it is in the URL (UX_STANDARDS.md → URL state).
  The route lists the tab names itself, checked against the feature's
  `SettingsTab` type with `satisfies`: a value import from `features/hours` in
  `validateSearch` (which is not code-split) pulled the whole screen and
  `temporal-polyfill` into the initial bundle (measured: 135.7 kB gzipped
  instead of 90.3 kB). The Hours manifest is not in the sidebar yet (slice 7).
- **Feature folder:** `features/hours/` has `api/` (a `hoursKeys` factory and
  query and mutation hooks for work terms, leave years and time adjustments,
  with delete and restore), `schemas/` (`fields.ts`, Zod fields that turn typed
  `h:mm` and `HH:MM` text into minutes; `settings.ts`, one schema per form,
  every bound from `@repo/types`), `components/`, `hooks/` and `index.ts`.
  **Public holidays are core** (ADR-0020 §3), so their hooks live in
  `features/core/public-holidays/`, which hours imports; hours does not own
  them.
- **Lists** are short and bounded, so each list hook follows the cursor to the
  end (`lib/api/pages.ts`, at most 50 pages) and caches an array. The contract
  typed `limit` as an empty object (the pagination DTO's `@ApiPropertyOptional`
  had no `type`); fixed in this PR (`type: 'integer'`), and the web still pages
  at the default 20.
- **The hours inputs are hours-specific** (they parse with `@repo/domain` and
  carry hours copy), so `TimeInput` and `DurationInput` live in
  `features/hours/components/`, not `components/ui/`. Both keep the typed text
  and rewrite it on blur only when it reads (`830` → `08:30`, `7.5h` → `7:30`);
  unreadable text stays for the form to flag. Their hint is linked after any
  description or error the form links, and can be `sr-only` where a visible
  hint covers a group (the weekday grid). `DurationInput signed` takes a
  leading minus for adjustments and shows a true minus (U+2212).
- **Terms tab:** the form adds terms from a Monday (next week's by default, or
  this week's for the first terms) prefilled from the latest terms, or edits
  the latest terms (`PATCH`; the Monday is read-only). Saved terms are listed
  latest first with the weekly target and paid overtime; each can be deleted
  with undo, and the API's 422 for the last terms comes back as a persistent
  error toast with its message. Clearing a target makes a day non-working; a
  minimum without a target, or above it, is a field error before anything is
  sent.
- **Leave tab:** a row per year: the allowance edits in its row with its own
  Save (explicit), bought leave is a switch that saves at once with a quiet
  "Saved" (a `role="status"` beside it), and the total is worked out in the
  browser. **Used and remaining** come from `GET /time-balances` as of the
  year's last day (rule 12 counts booked leave), shown as "—" before any terms
  exist; wired when this slice was rebased onto slice 9. Computed read-models
  (`hoursKeys.computed()`) have `staleTime: 0`, and every hours mutation
  invalidates them; core's holiday mutations cannot name an hours key, so a
  remount refetches. A 409 on a row's save is a persistent error toast with
  Reload.
- **Balances tab:** add an opening balance, confirmed forfeit or correction
  (date, balance, reason, signed amount; dated on the tracking start by
  default), and delete with undo. There is no edit: delete and add again.
- **Holidays tab:** previous and next year buttons around the heading, the
  import as the tab's primary action ("Add England and Wales bank holidays for
  2026"; a toast says how many were added, or that the year is complete), a
  manual add form, and delete with undo.
- **States:** loading is `aria-busy` with skeleton rows after 300ms
  (`useDelayedFlag`); a failed load is an inline error with Retry in place of
  the tab's content; a 422 on a form shows the API's message and `details` in
  an Alert at the top of the form; a 409 explains itself (a stale version
  offers "Reload the latest", a duplicate says what already exists).
- **Undo:** the delete removes the row from the cache at once
  (`lib/query/optimistic.ts`), the toast offers Undo for 8 seconds, and Undo
  calls the entity's `POST /:id/restore`; a failed delete restores the cache
  and raises a persistent error toast. Focus moves to the next row (or the
  list) after a delete (`hooks/use-focus-after-removal.ts`).
- **Not built here:** the in-app unsaved-changes guard needs `AlertDialog`,
  which slice 7 builds for the week rows; until then a dirty terms form only
  asks before a reload or tab close (`beforeunload`). `DropdownMenu` and
  `ContextMenu` are deferred to slice 7 too: no settings screen needs a menu.
- **Primitives** (`components/ui/`): `Tabs` (`@radix-ui/react-tabs`),
  `Switch` (`@radix-ui/react-switch`), `Toast` (`@radix-ui/react-toast`, with a
  `toast()` function and one `Toaster` in `AppShell`), `Skeleton`, and
  `NativeSelect` (a styled native `<select>`, added for the adjustment's
  balance and reason). `Button` gained a `wrap` variant, so a long label wraps
  at the reflow floor. `FormField` takes the schema's output type, for forms
  whose Zod schema transforms text. Radix Toast's F8 hotkey is off (Ctrl/Cmd+K
  is the only custom shortcut); the toaster follows `<main>` in the tab order,
  and its timers pause while it has focus or the pointer.
- **Global CSS:** in the dark theme, inputs and selects take
  `color-scheme: dark`, so native date pickers and select popups are dark.
  It is scoped to the controls: on the root it made the app-shell journey's
  dark-theme axe check flaky (colours were sampled mid-restyle). Tokens
  `--z-toast`, `--width-form` and `--width-toast`.
- **Dependencies:** `@radix-ui/react-tabs` 1.1.21, `@radix-ui/react-switch`
  1.3.7 and `@radix-ui/react-toast` 1.2.23 (MIT), and `@repo/domain` in the
  web (its `package.json` is now in the web Dockerfile's `deps` stage). Toast
  and its shared Radix parts are a 12.8 kB gzipped chunk loaded with the
  signed-in shell; Tabs and Switch load with the settings route.
- **Bundle** (`pnpm --filter @repo/web build`, gzipped): initial JS 90.3 kB
  (unchanged); the `/hours/settings` route chunk 33.3 kB, of which
  `temporal-polyfill` is most (the page uses the London date for defaults),
  against FRONTEND_QUALITY.md's advisory 150 kB.
- **Tests:** component tests for Tabs, Switch, Toast (lifetimes, the error
  toast persisting, Undo reached by Tab), Skeleton, NativeSelect, Button's
  wrap, `useDelayedFlag`, `formatDate`, the two inputs, the schemas, the terms
  form, and each tab against a stubbed API (`src/test/api-stub.tsx`): saves,
  undo, focus after delete, 422 details, 409 reload, load errors with Retry.
  `e2e/hours-settings.spec.ts` covers setting terms (and a field error),
  deleting terms and undoing from the keyboard, the tab in the URL with back
  and reload, bought leave, a holidays import with undo, axe on every screen
  in light and dark at 1280×800, and every tab reflowed at 320 CSS px. The
  journeys keep anchor terms from 26 Dec 2089 on the journey account, so their
  own terms are never the last (the API refuses to delete those).

- **Review fixes:** accessibility review measured `--input` at about 1.3:1
  (light) and 1.5:1 (dark), under 1.4.11's 3:1 for control boundaries, and
  this slice's fields depend on it. It is now `oklch(0.63 0 0)` and
  `oklch(0.56 0 0)`: at least 3.2:1 on background, card and muted in both
  themes, guarded by `styles/tokens-contrast.test.ts` (TECH_DEBT #16 closed).
  Also: 422 detail lines are keyed by index, and the leave row's pending cells
  are `aria-busy` with a "Loading" text alternative.
- **Settings keep actions inside each tab** (ui review): a tabbed settings
  screen has several forms, so each tab carries its own primary action rather
  than one in the page header.

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

### Slice 7: week view

- **Route and URL:** `/hours?week=YYYY-MM-DD` (`routes/_authed/hours/index.tsx`).
  `beforeLoad` normalises the week with a replace redirect: another valid date
  becomes its Monday, and a missing, unreadable or out-of-range one (a week not
  wholly in 2000–2100) becomes this week's Monday in Europe/London
  (`week/week-dates.ts`, on `@repo/domain`'s `londonDateAt` and `weekStartOf`).
  The helpers load with `import()` in `beforeLoad`, because only the component
  is code-split; the initial bundle stays at 90.2 kB gzipped.
- **Manifest:** `features/hours/tool.ts` (Hours, Lucide `Clock`, `/hours`, the
  five palette commands), listed in `app/tools.ts` after Home. `app/tools.ts`
  imports `tool.ts` directly, not the feature's `index.ts`, so the sidebar
  never pulls the screens into the initial bundle.
- **Layout (decided while building):** the page header holds the `<h1>`, the
  week navigator (previous, "Week of 5 Oct 2026" as an `<h2>` that labels the
  table and is a polite live region, next), a Settings link, "Download CSV"
  and "Go to today" (the primary action). Below it the table and the aside
  slot sit in a wrapping flex row: the table's basis is 56rem and the aside's
  `--width-aside` (20rem, a new token). The table's eleven columns need about
  60rem, so the aside sits beside the table on a 1920px window and wraps below
  it at 1280px (and at the reflow floor), rather than squeezing the table into
  a horizontal scroll at the design floor. `WeekView` takes the aside as
  `aside={(context) => …}` with `{ weekStart, asOf, calculation }`, rendered in
  a `div[data-slot="week-aside"]`; slice 10 part 2 fills it.
- **Table:** a real `<table>` labelled by the week heading, a row header per
  date (with "Today", "Unsaved" and the bank holiday badge), and no
  `role="grid"`. Columns: Start, End, Break, Leave, TOIL taken, Worked,
  Credited (the acceptance criteria ask for credited time per day), Flexi
  (`formatFlexi`: a sign and a word), Converted when the week's switch is on
  ("Converted (preview)" in the header before settlement), Warnings, and the
  actions (Save when the row is changed, then the "⋯" menu). A totals row
  shows worked, credited "of 37:30 target" and the week's flexi. An empty
  value is a dash read as "None" (or "Not counted yet" for flexi).
- **Rows as small forms:** each row keeps the typed text in a draft
  (`schemas/work-day.ts`, a Zod schema: both times or neither, a break only
  with times and shorter than the day, durations within a day). Enter in any
  field saves the row and Esc reverts it; there is no `<form>` per row (a form
  cannot wrap a `<tr>`), so the fields handle the two keys. A row is "Unsaved"
  only when its text reads differently from the saved day (`830` typed over
  `08:30` is not a change). Validation shows for the fields left in a changed
  row, and for every field on save, which moves focus to the first invalid
  one; passing through untouched rows with Tab flags nothing. The End field
  describes a "+1 day" tag when the end is at or before the start (not a live
  region, since slice 10 part 2).
  Instants come from `shiftInstants`, so a night across a clock change is
  exact. A new day is a `POST`, a saved one a `PATCH` with its `version`. A
  422 shows the API's `details` in an alert row under the day (linked from its
  fields) and keeps the input; a 409 or any other failure is a persistent
  error toast (the 409 offers Reload, which drops the row's draft). Each save
  raises a brief "Mon 5 Oct saved" toast.
- **Unsaved changes:** the app's first in-app guard. `WeekTable` uses TanStack
  Router's `useBlocker` (with `enableBeforeUnload`) while any row is changed;
  the new `AlertDialog` asks "Discard changes?" with "Keep editing" (focused)
  and "Discard changes". Changing week is a navigation, so it asks too; the
  table remounts per week, so drafts never leak into another week. The
  settings terms form still has only `beforeunload`; moving it to the same
  guard is a follow-up.
- **Row menu:** the "⋯" `DropdownMenu`, mirrored by a `ContextMenu` on the
  row. A text field keeps the browser's own right-click menu (copy, paste),
  so the row menu opens from the rest of the row; a row with no actions keeps
  the browser's menu everywhere (since slice 10 part 2). Items: Clear day (when the
  row has anything) and, on a bank holiday, "Mark bank holiday as worked" (or
  "…as not worked"), which changes the row's draft for an explicit save.
  Clear day soft-deletes, removes the day from the cache at once, raises
  "Day cleared · Undo" (8s; Undo calls restore) and moves focus to the next
  row's Start (the previous row's for Sunday) instead of the menu's trigger.
  Clearing a row with nothing saved just drops its draft.
- **Live totals (the data choice):** the table's figures are computed in the
  browser with `calculateHours`, from the saved days with each readable
  unsaved row in their place, and re-read from the server after each save
  (a save invalidates the week's days and `hoursKeys.computed()`). **Only the
  shown week is loaded** (at most seven days, the week's switch, the holidays
  of the week's years, and the terms): every figure the table shows is
  week-local — worked and credited time, day flexi, the week's excess and its
  levelling, and the per-day warnings. `calculateWeek`
  (`week/week-calculation.ts`) gives the engine the terms in force re-dated to
  the week's Monday (plus any later terms), so it computes from this Monday to
  the year's end instead of from the tracking start. A test proves every shown
  figure matches a run from the real tracking start with history, conversions
  and adjustments. The result's balances, TOIL-by-month split and history
  warnings (flexi caps, month-end TOIL, the leave allowance) are **not** valid
  in this calculation: the rows show only the week-local warnings, and the
  aside takes balances from `time-balances` and `time-summaries`.
- **Engine timing:** the first calculation runs as the week's data arrives (a
  `useMemo` over the loaded data), never first on a keypress, and with the
  re-dated terms it covers less than a year of days.
- **Warnings in the row:** "Below 5:30 minimum", "Before 07:00", "After 19:00"
  (an end after the band or on the next day), "Nothing recorded", "Time off
  over the 7:30 target" and "Times not valid", each with a ⚠ icon and a
  screen-reader "Warning:"; "Break raised to 0:30" is a note (ℹ, "Note:").
- **Download CSV:** the shown week's saved days (not unsaved rows), through
  `daysCsvRows` and `toCsv`, saved as `hours-<weekStart>.csv` from a Blob
  (`lib/download.ts`), with a "Week of 5 Oct 2026 downloaded" toast.
- **States:** skeleton rows at the final height after 300ms, under the real
  table head; a load error inside the table with Retry (the head and the page
  header stay); no terms: "Set your working terms to start tracking hours"
  with a "Set working terms" link; before the tracking start: "Tracking
  starts on Mon 7 Sep 2026" with "Go to the first week"; an empty week: seven
  editable rows and "No time recorded this week."
- **Primitives:** `DropdownMenu` and `ContextMenu` (sharing one menu look;
  non-modal, because Radix's modal menus hide the page with `aria-hidden`
  while it stays focusable, which axe flags; Tab closes them),
  `AlertDialog` (it remembers what had focus when it opened, so a dialog
  raised by a blocker returns focus there; Radix returns focus only to a
  trigger), and `Badge` (no dependency). Tokens: `--z-modal`,
  `--width-dialog` and `--width-aside`.
- **Dependencies:** `@radix-ui/react-dropdown-menu` 2.1.24,
  `@radix-ui/react-context-menu` 2.3.7 and `@radix-ui/react-alert-dialog`
  1.1.23 (MIT). Measured with esbuild (minified, React external): 30.9, 31.2
  and 13.7 kB gzipped alone, 33.5 kB together, and **13.5 kB** on top of the
  Radix packages already in the app (they share the menu, popper and focus
  code with Tooltip, Toast, Tabs and Switch).
- **Bundle** (`pnpm --filter @repo/web build`, gzipped): initial JS 90.2 kB
  (unchanged). `/hours` loads its 0.3 kB route chunk, the hours feature chunk
  (36.6 kB, shared with `/hours/settings`, with the three Radix packages) and
  `@repo/domain` with `temporal-polyfill` (20.2 kB, shared): 57 kB of lazy JS
  against FRONTEND_QUALITY.md's advisory 150 kB, besides the chunks the
  signed-in shell already loads.
- **Tests:** unit tests for the row schema (the four time formats, a night
  shift, the October clock change, both-or-neither, a break without times or
  as long as the day, bounds), week normalisation and the navigator's limits,
  and `calculateWeek` (equal to a run from the tracking start, both worked
  examples, the preview before settlement, the terms in force, the row
  warnings); component tests for `WeekView` against a stubbed API (live
  figures, Enter saves with the right body, "+1 day" announced, Esc reverts,
  validation on blur and on save, `PATCH` with the version, 422 details
  inline, 409 Reload, Clear day with focus and Undo, the bank holiday badge
  and menu, the Converted column, every state, the navigator and Go to today,
  the unsaved-changes dialog, CSV); and tests for the four primitives and the
  registry. `e2e/hours-week.spec.ts` runs on its own account
  (`E2E_WEEK_USER`, terms from 5 Jan 2026, created in `global-setup.ts`), so
  its past tracking start never moves the settings journeys': the URL
  normalisation and the sidebar's `aria-current`; the keyboard-only journey
  (a day with a break, a raised break, a night shift, leave, the totals,
  Clear day and Undo from the keyboard, the guard and Esc revert, reload);
  axe at 1280×800 on each screen and the dialog; and reflow at 320 CSS px.
  The shared journey helpers moved to `e2e/support.ts`.
- **Found while building:** the table's scroll container needs `relative`:
  the fields' `sr-only` hints are absolutely positioned, and without a
  positioned container they widened the page at 320 CSS px.

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

### Slice 10 (part 1): summary view and aside components

- **Route:** `/hours/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=week|month`
  (`routes/_authed/hours/summary.tsx`). **Decided while building:** `from`
  and `to` are both **inclusive** (the owner reads "1 to 31 October"); the web
  sends the API `to + 1 day`. With either date missing the page shows **this
  month, by week** (the default), so a bare bookmark always opens on the
  current month; a malformed value falls back rather than failing. The group
  names are listed in the route file, checked against the feature's type with
  `satisfies`, as the settings route does.
- **Page:** a page header (`<h1>` "Hours summary", the range and grouping as a
  line under it, and "Download CSV" as the primary action), then two
  `NativeSelect`s, **Dates** (This month, Last month, This year, Custom) and
  **Group by** (Week, Month). **Decided while building:** presets are a native
  select rather than toggle buttons, so no new primitive was needed and the
  keyboard and screen-reader behaviour is the browser's. Picking a preset
  writes both dates to the URL (a history entry, so Back undoes it); Custom,
  or a range no preset matches, shows a two-date form (RHF + Zod,
  `schemas/summary.ts`) that applies on "Show these dates".
- **Range limit:** a custom range over 366 days, or ending before it starts,
  is a field error before anything is sent; a URL with such a range shows the
  same message in place of the table and sends nothing; the API's 422 (say, a
  hand-edited URL the web did not catch) shows its message and details in an
  alert.
- **Table** (`summary-table.tsx`): a real `<table>` with a caption, a row
  header per period ("Week of 5 Oct 2026", "October 2026"), the thirteen
  figures in `h:mm`, right-aligned with tabular numerals (flexi and the flexi
  balance with a sign and a word, `+0:40 over`), and a `<tfoot>` totals row
  (sums; the flexi balance is the last period's). The table and the CSV share
  one column list (`summary-columns.ts`). **Decided while building:** a
  period's warnings are a row of their own under its figures ("Warnings for
  Week of 11 Oct 2088: …", badges with a ⚠ icon and text, a count when
  repeated, `BREAK_RAISED` as a quieter note), because a fourteenth column of
  badges made every row several lines tall. The engine's codes map to copy in
  `warnings.ts` (`WARNING_LABELS`), which the week view can reuse. The API
  widens the range to whole weeks or months, so a note linked to the table
  says what it covers when that differs from the dates chosen.
- **Width:** at 1280×800 with the sidebar expanded, the week table is about
  1,120px in a 990px content column, so it scrolls sideways **inside its own
  region** (UX_STANDARDS.md allows it for tables; the region is focusable so
  the keyboard can scroll it, WCAG 2.1.1). With the rail, or at 1920, it fits.
- **States:** skeleton rows after 300ms on first load; a new range keeps the
  shown rows (`aria-busy`) while it loads, **but a new grouping does not**:
  weeks relabelled as months would be wrong, not just stale (found in the
  journey, fixed, and covered by a regression test). Empty: "No time
  recorded between these dates." when no period has any worked or credited
  time (**decided**: missing-day debits alone do not count as recorded time).
  Error: an alert with Retry. "Download CSV" is disabled while there is
  nothing to download.
- **Leave strip:** the leave year of the range's last day, from
  `time-balances` as of 31 December (the leave tab's query, so they share a
  cache entry): allowance, used and remaining ("over allowance" when
  negative).
- **CSV:** `summaryCsvRows` → `toCsv` from `@repo/domain`, built in the
  browser from the rows shown and saved by `lib/download.ts` as
  `hours-summary-<from>-<to>.csv` (the inclusive dates). Columns: period,
  from, to (inclusive), every figure in `h:mm` and decimal hours, the week's
  conversion (Off, Preview, Applied), and the warnings as text; then a totals
  row.
- **API hooks:** `api/time-summaries.ts` (`hoursKeys.summaries(query)` under
  `computed()`, `staleTime: 0`) and `api/excess-conversions.ts`
  (`hoursKeys.excessConversionList({ from, to })`; `useSwitchConversion`
  POSTs to switch on and DELETEs the week's row to switch off, then
  invalidates the conversions and `computed()`). **Decided while building:**
  reaching the state asked for is success: a 409 on switching on means another
  tab already did, and a 404 on switching off means it is already off.
- **Aside components** (for the week view to mount; not mounted by this part):
  - `ThisWeekPanel({ weekStart, asOf, live?, recalculationNotice? })`: loads
    the week's `time-summaries` group (`groupBy=week`, which carries the
    conversion detail) and its switch row. It shows credited against target,
    the week flexi, "After conversion" once the switch is on and there is
    excess, the switch (saves at once with a quiet "Saved" in a
    `role="status"`; not disabled while saving, so focus stays on it; a failed
    save is a persistent error toast and the switch shows the saved state),
    then TOIL, overtime ("2:00 unpaid", "1:00 paid, 1:00 unpaid") and "Preview
    until Fri 9 Oct" or "Applied Fri 9 Oct"; or "Nothing to convert" for a
    week that is net zero or negative. `live` took
    `thisWeekFigures(result, weekStart)` from the week view's own engine run,
    so the panel followed unsaved typing (part 2 narrowed it to the
    week-local figures, laid over the saved summary). `recalculationNotice`
    fills a polite live region at the foot of the panel.
  - `BalancesPanel({ asOf })`: flexi (with its word), TOIL this month against
    its cap and TOIL taken, overtime this year (paid and unpaid, both always
    shown), and leave left; "No balances yet" before any terms.
  - `useRecalculationNotice(weekStart)` →
    `{ notice, notify(before, after, editedWeekStart) }` (part 2 made it
    `announce(message, editedWeekStart)`): `recalculationMessage` runs
    `recalculation()` and
    writes "Week of 28 Sep recalculated: TOIL 3:00 → 2:00, overtime 0:00 →
    0:00. September totals changed."; `notify` raises a 4s info toast and
    keeps the message for the panel's live region. An edit that moves neither
    the week's conversion nor an ended month says nothing.
- **Shared additions:** the **Badge** primitive (`components/ui/badge.tsx`,
  DESIGN_SYSTEM.md → Badge); `formatDate` styles `weekdayDayMonth` ("Fri 9
  Oct"), `dayMonth` ("28 Sep"), `monthYear` and `month`. **Decided while
  building:** recent ICU data abbreviates September as "Sept" in en-GB;
  `formatDate` keeps every short month to three letters ("Sep"), as this
  document writes them.
- **Bundle** (`pnpm --filter @repo/web build`, gzipped): initial JS 90.2 kB
  (unchanged). The `/hours/summary` route chunk is 0.3 kB and loads the
  shared `hours` feature chunk, 37.5 kB (with `temporal-polyfill`), which
  the settings route now shares (it was 33.3 kB): about 38 kB for the route
  against FRONTEND_QUALITY.md's advisory 150 kB.
- **Tests:** component tests for the summary (by week and month, headers and
  figures, warnings rows, totals, the whole-weeks note, presets and custom
  dates to the URL, the 366-day limit in the form and from the URL, the API's
  422, empty, Retry, the leave strip, the CSV download and the grouping
  regression), the range and column helpers and CSV rows, the warning copy,
  `ThisWeekPanel` (switch on and off by mouse and keyboard, applied and
  preview, nothing to convert, a failed save, 409 as success, live figures,
  the live region, Retry), `BalancesPanel`, the recalculation message and
  hook (the worked example, the cross-month example with "September totals
  changed", no change), Badge, and the new date styles.
  `e2e/hours-summary.spec.ts` reads October 2088 by week and by month (the
  worked example applied, missing days, month-end TOIL to unpaid overtime),
  Back and reload, the presets from a browser clock set to 15 Nov 2088
  (`page.clock`), the custom range limit, the CSV download, axe in light and
  dark at 1280×800, and reflow at 320 CSS px with the table scrolling in its
  region. The journeys use their own terms from 27 Sep 2088, before every
  other journey's, so they never become the latest terms the settings
  journeys edit (they do become the journey account's tracking start, unless
  another journey's terms are earlier).
- **Left for the lead (part 2):** mounting the aside in the week view, the
  switch and edit-after-settlement journeys, the browser-equals-API check for
  the seeded week, and links to the summary from the week view.

### Slice 10 (part 2): the aside in the week view

- **Mounted:** the `/hours` route passes `WeekView` an `aside` render prop
  that renders `WeekAside` (`components/week-aside.tsx`): an `<aside>`
  landmark named "This week and balances" holding `ThisWeekPanel` over
  `BalancesPanel`. It sits beside the table on a 1920px window and below it
  at 1280px and at the reflow floor (slice 7's layout). `WeekAsideContext`
  gains `recalculationNotice`. The feature's public surface is now what the
  routes mount (`WeekView`, `WeekAside`, the screens and their types); the
  panels and rule 11's helpers stay inside the feature.
- **`live` figures (decided while building):** the week view's calculation
  runs one week with no history (slice 7), so only its **week-local**
  figures are passed on: credited, target, the week's raw flexi and its
  excess E (`liveWeekFigures`, which replaces `thisWeekFigures`). E is
  week-local (rule 6), and passing it keeps "After conversion" (raw − E)
  following the typing. The panel **always** loads the week's
  `time-summaries` group and lays `live` over it: the conversion's state,
  settlement date and its **TOIL and overtime split** (which depends on the
  TOIL already converted earlier in the month, rule 7) are always the
  API's, and move after a save. A test shows why: alone, the worked example
  week converts 3:00 to TOIL; with October's earlier 6:30 it is 1:00 TOIL
  and 2:00 overtime. While a row is unsaved the split can therefore trail the
  live E until the save is re-read. The balances are always the API's.
- **Rule 11 notice (decided while building):** `recalculationMessage` and
  `recalculation()` compare engine results, which the week view does not
  have for anything beyond the shown week, so the notice compares the
  API's figures instead. `useWeekRecalculation(weekStart, asOf)` observes the
  week's `time-summaries` group (and, when the week touches a month that has
  ended, its month groups; otherwise no extra request) and gives `WeekTable`
  an `onEditStart` callback: as a save, a clear or an undo starts it takes
  the "before" from the cache; once the edit succeeds (the mutation has
  already re-read the computed figures) it reads the "after" and
  `summaryRecalculationMessage` builds the same wording: "Week of 5 Oct
  recalculated: TOIL 3:00 → 2:00, overtime 0:00 → 0:00" when the week's
  conversion is **applied** and its TOIL or overtime moved (a preview
  changes nothing yet, so it says nothing), plus "September totals changed"
  when an ended month's TOIL, unused TOIL, overtime or flexi moved (the
  fields `recalculation()` compares). `useRecalculationNotice` now takes the
  message (`announce(message, weekStart)`) rather than two engine results,
  so both paths share it: a 4s info toast and the panel's polite live
  region. An ordinary edit still says only "Mon 5 Oct saved".
- **Keeping in step:** every day save, clear and undo invalidates the week's
  days, the switch rows (`weekKeys.excessConversions()`, now the same key
  as `hoursKeys.excessConversions()`) and `hoursKeys.computed()`; the
  switch invalidates the switch rows and `computed()`. So the table's
  Converted column, both panels and the totals move together.
- **Header:** "Summary" (the shown week's month, by week:
  `/hours/summary?from=2026-10-01&to=2026-10-31&groupBy=week`) and
  "Settings" as ghost links before "Download CSV" and "Go to today".
- **Review fixes to slice 7** (UI, accessibility and security reviews):
  - the "+1 day" tag is no longer a live region (it re-announced as partial
    times failed to parse); the End field's description still reads it;
  - the row's `ContextMenuTrigger` is disabled when the row has no actions,
    so right-click and Shift+F10 keep the browser's own menu;
  - `DayRow` is memoised by value with handlers that take the date (created
    once; `save` and `clear` go through a stable wrapper that calls the
    latest version), and a row gets only the engine figures it shows
    (`dayFigures`), because each day's running flexi balance changes with
    every earlier day: a keystroke re-renders only its own row (a test counts
    the renders). The engine run stays one `useMemo` per change;
  - `?week=` is capped at 10 characters in the route's schema;
  - `downloadText` revokes the file's URL after 10 seconds, not at once;
  - `e2e/global-setup.ts` refuses to create the journey accounts (whose
    passwords are in the repository) unless `DATABASE_URL` names a database
    ending in `_test`, or `CI=true` (TESTING.md → Frontend tests).
- **Deduplicated in the rebase:** slices 7 and 10 part 1 each added a
  `Badge` and `lib/download.ts`. Part 1's `Badge` (with its `warning` and
  `info` variants) is kept, and covers the week view's `default` and
  `outline` badges; part 1's `downloadText` is kept and the week view calls
  it. The week view's `formatDate` style `weekday` was the same as
  `weekdayDayMonth` and is gone; `medium` ("5 Oct 2026") stays.
- **Bundle** (`pnpm --filter @repo/web build`, gzipped): initial JS 90.5 kB
  (unchanged). The shared `hours` feature chunk is 42.6 kB (40.0 kB before
  the aside) and `@repo/domain` with `temporal-polyfill` 20.2 kB: about
  63 kB of lazy JS for `/hours` against FRONTEND_QUALITY.md's advisory
  150 kB.
- **Tests:** unit tests for `liveWeekFigures` and `summaryRecalculationMessage`
  (applied, preview, unchanged, an ended month); component tests for the
  mounted aside (the landmark, both panels, live figures following an
  unsaved row while the split stays saved), the header links, switching in
  the aside updating the Converted column, the notice after a save in an
  applied week (toast and live region) and none before settlement, the
  memoised rows and the context menu on an empty row, and `downloadText`.
  `e2e/hours-week.spec.ts` adds, on the week journey account and a browser
  clock set with `page.clock`: Shift+F10 on a row with actions opens its
  menu and Esc returns focus; the aside beside the table at 1920×1080 with
  no page scroll; switching conversion on and off before settlement (a
  preview) and after it (applied; Tuesday's converted figure is 2:00 since
  the [block change](#change-conversion-in-whole-blocks-2026-09-23)); an edit after
  settlement raising "Week of 5 Oct recalculated: TOIL 3:00 → 2:00, overtime
  0:00 → 0:00." in the toast and the live region; and the **browser's totals
  equal the API's** for the worked-example week of 5 Oct 2026 (seeded through
  the API; the table's totals row and the aside's figures against
  `GET /time-summaries` and `GET /time-balances`), all with axe.

### Change: conversion in whole blocks (2026-09-23)

- **Why:** the owner, after using the shipped tracker: "i have to input my
  time sheet in 30min blocks so leveling to 0:23 isn't correct". Decided with
  the owner: minutes that don't make a whole block **stay as flexi** (E =
  2:45 converts 2:30 and keeps 0:15 in the flexi balance), and the block is an
  **effective-dated work terms setting, default 0:30**. Rules 6 and 7, the
  worked examples and the test matrix above are updated.
- **Engine** (`@repo/domain`): `WorkTerms.conversionBlockMinutes`
  (`defaultWorkTerms` and `DEFAULT_CONVERSION_BLOCK_MINUTES` = 30);
  `levelExcess(excess, days, blockMinutes)` takes one block at a time and
  stops when no day has a whole block of worked time left. `WeekResult` gains
  `blockMinutes` and `convertedMinutes` (the whole blocks taken, preview or
  applied). Raw flexi is unchanged; only allocated minutes leave a day, so the
  remainder stays in the balance with no extra rule. The TOIL cap walk, month
  end and paid/unpaid are unchanged, so a block can split into TOIL and
  overtime at the monthly cap (rule 7).
- **Migration 3** (`add_conversion_block`): `work_terms.conversion_block_minutes
int NOT NULL DEFAULT 30` with `ck_work_terms_conversion_block_range`
  (1–480), additive; existing terms take 0:30. **The bound:** at least a minute
  (a 1-minute block is the old minute-by-minute levelling), at most 8:00: a
  block longer than a working day would rarely convert anything, and 8:00
  covers any timesheet granularity (15, 30 or 60 minutes). The same bounds are
  `CONVERSION_BLOCK_MIN_MINUTES` and `CONVERSION_BLOCK_MAX_MINUTES` in
  `@repo/types`.
- **API** (additive): `conversionBlockMinutes` on the work terms create,
  update and response bodies (omitted → 30 on create, kept on update; `null`
  and out-of-range values are 422s). `time-summaries` week groups also carry
  `conversionBlockMinutes` and `conversionMinutes` (the whole blocks the
  conversion takes, preview or applied) for the aside. `pnpm data:export` has
  the new field through the response DTO.
- **Web:** Settings → Terms has **Conversion block** in the Limits group
  (a duration field, 0:01–8:00). The aside's This week panel shows "After
  conversion" as raw − converted, "0:15 stays as flexi" under the TOIL and
  overtime when there is a remainder, and "Less than one block (0:30) to
  convert" (the week's block) when E is above zero but under a block, in
  place of the split. **Decided:** that wording, rather than "Nothing to
  convert", so a small excess with the switch on is not mistaken for an empty
  week.
- **Tests:** domain unit tests for the new worked example (Mon 0:30, Tue 2:00,
  Thu 0:30), the cross-month example, ties, below target, a 2:45 remainder,
  0:15 and 1:00 blocks, E under a block, a block larger than E, previews,
  a block split at the TOIL cap, and every allocation a multiple of the
  block; API unit and e2e tests for the default, a custom block, the 422
  bounds (and the `CHECK`), and a `time-summaries` week whose excess is not a
  whole block; web tests for the field, the schema bound and the aside's
  remainder and under-a-block text, and the week journeys' figures.
