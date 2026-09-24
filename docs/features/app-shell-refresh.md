# App shell refresh

- **Status:** Shipped (2026-09-24). Approved by the owner on 2026-09-23, who
  chose the direction and the scope in the session that asked for it.
- **Change class:** Feature (a design-system and UI change across the shell and
  the hours screens; one PR). Escalation trigger: a new runtime dependency,
  `@fontsource-variable/inter` (fonts only, no JavaScript; see
  [Typography](#typography)). No API, engine or schema change.
- **Roadmap item:** PRODUCT.md's "App shell" (density tokens, motion tokens,
  three-way theme); router pending and error states stay in Next.

## Problem & outcome

The owner's words (2026-09-23): **"make the application look amazing"**, and
**"also fix all the visual issues as part of make the application look
great"**.

The first tool worked but looked like a starter kit: a 36px default control,
Tailwind's default type steps, flat tables, no surfaces, one blue, and several
visible faults (below). The outcome is a calm, polished professional tool in
the style of Linear or Stripe, driven entirely by tokens and primitives, with
every hours screen restyled and no change to behaviour, copy intent or the API.

**Direction chosen by the owner:** "Calm, polished pro tool — refined type
scale and spacing, subtle surfaces and cards, a clear accent colour, crisp
tables with zebra/hover rows, gentle motion, status colours for flexi (with
words kept), a proper dashboard feel."

**Scope chosen by the owner:** the hours screens (the week view `/hours` and
its aside, the summary `/hours/summary`, the settings `/hours/settings`) and
the app shell and design system (palette and accent, typography, density with
32px controls, motion, three-way theme). The home and sign-in pages change only
through the shared shell and tokens.

## The visual issues, and how each was fixed

| #   | Issue                                                                                                                             | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The week view's "Today" marker was an outlined box stretched across the cell, like an empty input.                                | A small **filled accent tag** ("Today", `Badge variant="primary"`, sized to its text), and the whole row on the `highlight` surface with a 3px accent **marker bar** on its first cell (`TableRow tone="highlight"`). `aria-current="date"` is unchanged.                                                                                                                                                                                                                                                                                                                                        |
| 2   | At 1280px the footer's "of 37:30 target" wrapped onto three lines, and the aside stacked below the table (off-screen).            | The aside sits **beside** the table from a 56rem content width (a 1280px window) by a container query, and stacks below it under that, down to the 320 CSS px floor. The table was tightened to fit: 28px fields 3rem wide, 13px table text, 4px numeric padding, and a day's warnings moved to a row of their own. The footer shows "of 37:30" on one short line ("target" is read by screen readers; the aside says it in words). A Playwright check proves the fit at 1280×800 and 1920×1080 with the widest table (the Converted column on and a row being edited): no page or table scroll. |
| 3   | The summary's Target counted whole periods, days still to come included (112:30 target against 79:00 credited, with flexi +2:00). | Periods are marked **In progress** (`info` tag) or **Upcoming** (neutral tag, figures muted) against today, and a footnote under the table, linked to it with `aria-describedby`, says: "Target counts every working day of a period, including days still to come; flexi counts the days up to today …". See [the decision](#summary-target-to-date) for why not a "target to date" column.                                                                                                                                                                                                     |
| 4   | The summary showed "Break raised to minimum" as a warning badge, though it is a note.                                             | Notes are `info` chips with an ⓘ icon and a "Note:" prefix for screen readers; warnings are `warning` chips with a ⚠ and "Warning:", as the week view already did. The row's name says "Notes for …" when it holds only notes.                                                                                                                                                                                                                                                                                                                                                                   |
| 5   | General polish.                                                                                                                   | One spacing rhythm and type scale; tabular, right-aligned numbers everywhere; a page header on every screen; designed loading (skeletons at row height), empty (`EmptyState`) and error states; one focus ring; `Button isPending` with a spinner; zebra and hover rows; cards for the aside and each settings group; an indigo accent; flexi in a status colour **with** its sign and word.                                                                                                                                                                                                     |

## Decisions

### Palette

OKLCH, one hue family. Neutrals are a cool slate carrying a trace of the
accent's hue (265). Values are in `globals.css`; every foreground/fill pair in
both themes is measured by `tokens-contrast.test.ts`.

| Role                                           | Light                                                             | Dark                                  |
| ---------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Page `background`                              | `0.984 0.003 265` (a step below cards)                            | `0.16 0.006 265`                      |
| `card` / `popover`                             | white                                                             | `0.198` / `0.225` (lighter = higher)  |
| Accent `primary` (= `ring`)                    | indigo `0.5 0.2 268`                                              | `0.7 0.14 268`                        |
| `muted-foreground`                             | `0.49 0.018 265`                                                  | `0.72 0.014 265`                      |
| `table-stripe` / `table-hover` / `highlight`   | `0.981` / `0.964` / `0.962 0.022 268`                             | `0.213` / `0.243` / `0.245 0.032 268` |
| `success` / `warning` / `info` / `destructive` | solid fill + foreground, a `-soft` fill and a `-text` colour each | the same roles, re-tuned for dark     |

**Flexi** is `success-text` when over, `warning-text` when under, the text
colour when level, always with its sign and word (`FlexiValue`). Under is amber,
not red: being behind on flexi is normal, not an error.

### Typography

- **Inter, self-hosted** (`@fontsource-variable/inter`, the variable weight
  axis). The browser downloads only the subsets a page uses: latin is
  48 kB of woff2, cached after the first visit; no JavaScript is added. It
  closes the BACKLOG item: the stack named Inter but never loaded it, so the
  app rendered in whatever the OS offered. Inter's tabular figures and its
  `cv11` single-storey "a" read well in dense numeric tables.
- The **type scale** is implemented as utilities: `text-meta` 12/16,
  `text-small` 13/18, `text-body` 14/20 (the body default), `text-lead` 16/24,
  `text-h3` 15/22 semibold, `text-h2` 18/28 semibold, `text-h1` 24/32 semibold
  with −0.02em tracking. `text-h3` is 15px rather than the proposed 16px: card
  titles at 16px competed with the 24px page title at this density. `h2` is
  18px for the same reason.
- Dense tables (week, summary) are set in `text-small` (13px).

### Density, radius, elevation

- Controls: `--control-sm` 28px, `--control-md` **32px (the default)**,
  `--control-lg` 40px; `--icon-button` 32px; rows `--row-height` 32px. In rem,
  so they follow the owner's text size. `Button` and `Input` share the sizes;
  the week table's fields are `sm`.
- Radius base 8px (was 10px): 4 / 6 / 8 / 12. Controls 6px, cards 12px, tags 6px.
- Elevation: `shadow-xs` for cards (a hairline), `shadow-md` for menus and tooltips,
  `shadow-lg` for dialogs and toasts, as `--elevation-*` tokens so dark mode uses deeper,
  blacker shadows while its surfaces carry the elevation.

### Motion

`--duration-fast` 120ms (colour changes: the default for every `transition-*`),
`--duration-base` 180ms (menus, tooltips, toasts entering), `--duration-slow`
240ms (the progress bar). Easings `ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`,
`ease-in`, `ease-in-out`. Entrances **move but never fade**, so an axe run
straight after a menu opens never samples a half-transparent colour.
`prefers-reduced-motion` collapses everything (unchanged).

### Theme

A three-way **Theme** menu in the header (Light, Dark, System, as radio items
with a tick), replacing the light-or-dark button. Its button is named "Theme: System"
(the current choice) and shows the choice's icon. The pre-paint script is
unchanged.

### Layout

- Sidebar 224px (was 240px): the tools' names are short, and the 16px went to
  the week table at 1280px.
- `--width-aside` 16rem beside the week table at 1280px, `--width-aside-wide`
  20rem from an 80rem content width (1920px windows). Both by container query.
- On a wide window the week card grows to `--width-data-card` (62rem) with the
  aside straight beside it, and the table's columns share the card's width, so
  there is no empty band before the row menu.
- The summary's numeric columns pad 4px a side, so every column, a balance of
  "−380:15 under" included, fits at 1280px with the sidebar expanded.
- In a settings group, a field's description sits under its input with the
  format hint, and fields are a fixed width (`w-64`), so every input in a group
  lines up.
- Settings are capped at `--width-form` (880px) at the content's left edge.

### Week view: warnings in their own row

A day's warnings and notes, and its bank holiday, moved from a Warnings column
(and the day cell) to a row of chips under the day, spanning the table. A
column of wrapped warnings cost 120–150px at 1280px, which the table did not
have beside the aside. The notes row is named for screen readers ("Warnings for
Tue 22 Sep: …", or "Notes for …" when there is no warning).

### Summary: target to date

The API's `targetMinutes` is the whole period's. A client-side "target to date"
would have to repeat the engine's day rules (terms in force, the tracking
start, whether today counts yet), and `credited − raw flexi` is wrong as soon
as a future day holds booked leave or a bank holiday (credited counts it, flexi
does not). A figure that is sometimes wrong is worse than none, so the summary
**labels** the periods that are not over and **explains** the target in a
footnote. The API is unchanged; if a target-to-date figure is wanted later, it
belongs in `time-summaries`.

## What changed on each screen

- **Shell:** a brand mark (an accent tile) and the name; a translucent header;
  the three-way Theme menu; the sidebar's current item has a surface, a medium
  weight, an accent icon and a marker bar at the sidebar's edge; content padding
  24px with 48px below.
- **Week view:** before, a header crowded with the navigator, a hint paragraph,
  a flat table at the page's edge and the aside wrapped below at 1280px. Now: a
  page header ("Hours", with Summary, Settings, Download CSV and the primary Go
  to today); the table in a card whose header holds the week navigator (and
  "No time recorded this week."); zebra rows with a hover surface; the today row
  highlighted with a marker and a "Today" tag; flexi in status colours; the
  Converted column's "(preview)" under its label; the notes row of chips; a
  totals footer; the keyboard hint in the card's footer. The aside is two cards:
  **This week** (credited against the target with a progress bar that turns
  green at the target, flexi in colour, the conversion switch in a tinted well)
  and **Balances**. Empty states ("Set your working terms…", "Tracking starts
  on…") are `EmptyState`s with an icon and one action.
- **Summary:** a page header with the range and the primary Download CSV; the
  Dates and Group by filters and custom dates in the card's header over the
  table; TOIL and Overtime as column groups ("Earned, Taken, Unused"; "Paid,
  Unpaid") so the table fits 1280px; In progress and Upcoming tags; notes as
  info chips, warnings as warning chips; the notes under the table; the leave
  year as a card of three stat tiles (Allowance, Used, Remaining) and a bar.
- **Settings:** a page header; tabs at 40px with the accent underline; each
  group a card (New terms, Saved terms, Leave years, Add a leave year, Balance
  adjustments, Add an adjustment, Holidays with its year navigator and import,
  Add a holiday); tables on the shared Table parts with zebra rows; field
  widths from tokens; pending buttons with a spinner instead of "Saving…".

## Tests

- `tokens-contrast.test.ts` measures every fill/foreground pair in both themes
  (text 4.5:1; control boundaries, the ring and state fills 3:1) with a general
  OKLCH → sRGB conversion.
- Component tests for `Button` (sizes, `isPending`), `Table`, `ProgressBar`,
  `FlexiValue`, the Theme menu, `periodState`, and the summary's states and
  chips; the week and summary tests updated for the new markup.
- Playwright: the theme menu from the keyboard with axe in both themes; the
  week view's aside beside a table that does not scroll at 1280×800 and
  1920×1080; axe light and dark, and reflow at 320 CSS px, on every screen
  (existing journeys, updated). `e2e/screenshots.spec.ts` takes a review set of
  every hours screen at both sizes in both themes when `E2E_SCREENSHOT_DIR` is
  set; the images are for people to look at and are never committed.
