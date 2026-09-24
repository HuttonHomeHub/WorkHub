# UX Standards

> The canonical interaction and layout standard for WorkHub's desktop UI: how
> the shell is built, how the keyboard works, how feedback is given, and what
> must be deep-linkable. Visual tokens live in
> [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), accessibility rules in
> [`ACCESSIBILITY.md`](ACCESSIBILITY.md), and the technical patterns in
> [`FRONTEND_ARCHITECTURE.md`](FRONTEND_ARCHITECTURE.md). The product profile
> these rules serve is [`PRODUCT.md`](PRODUCT.md).

**What WorkHub is, in one line:** a private tool for one owner, driven by
keyboard and mouse in a Chromium or Firefox window of **1280px or wider**, at
**compact density**, in light or dark.

Items marked **_planned_** describe a target the code has not reached yet. Do not
cite them as existing behaviour; build them when the feature that needs them
lands.

## Principles

1. **Predictable beats clever.** The same action looks and behaves the same
   everywhere. Reuse a pattern; never invent a per-page interaction.
2. **Dense, not cramped.** The owner reads a lot of rows at once. Fit more on
   screen, but keep hit areas, focus rings and spacing honest.
3. **Reversible beats confirmed.** Do the thing, then offer undo. Stop the owner
   only when the action genuinely cannot be undone.
4. **Keyboard-complete.** Every action has a keyboard path. Hover reveals nothing
   that a keyboard cannot reach.
5. **The URL is the state.** A view that cannot be reloaded, bookmarked or opened
   in a second tab is incomplete.
6. **Exact with data.** Money is integer pence, dates are Europe/London, and
   numbers align in columns.

## App shell

One shell, composed once as a layout route (`routes/_authed.tsx` →
`components/layout/app-shell.tsx`). No page builds its own chrome.

```text
┌──────────────────────────────────────────────────────────┐
│ header  (48px, sticky)   title · search · theme · account│
├────────┬─────────────────────────────────────────────────┤
│ side   │ page                                            │
│ bar    │  ┌ page header: h1 · breadcrumb · primary action│
│ 240px  │  ├ content                                      │
│ (rail  │  │   list pane  │  detail pane                  │
│  56px) │  └                                              │
└────────┴─────────────────────────────────────────────────┘
```

**Sidebar** (`components/layout/sidebar.tsx`): one entry per tool, built from
the tool manifests in `app/tools.ts` (ADR-0020).

- Two states: **expanded** (240px, icon + label) and **rail** (56px, icon only
  with a tooltip). The toggle is a header button named "Sidebar" with
  `aria-expanded` and `aria-controls`, and a tooltip naming its action
  ("Collapse sidebar"); the state persists per browser in `localStorage` and is
  restored before first paint.
- Rail state never hides a destination — it hides labels. A tooltip on hover
  **and** an accessible name for the keyboard is required on every rail item.
- The current destination is marked `aria-current="page"` and visually distinct
  by more than colour.
- Below **48rem** wide (a 1280px window at 200% zoom and beyond, down to the
  320 CSS px reflow floor) the sidebar is always the rail, whatever the stored
  preference, and the header toggle is not shown because it would do nothing.
  The sidebar never becomes an overlay panel.

**Header** (48px, sticky, `z-index: --z-header`): the sidebar toggle, app name,
the command-palette trigger (_planned_), theme control, account menu. Sticky
chrome must not obscure focus — `scroll-padding-top: var(--header-height)` on
`<html>` keeps focused elements clear of it
([ACCESSIBILITY.md](ACCESSIBILITY.md), 2.4.11). Below 48rem the header wraps
onto more lines instead of clipping or hiding its content, and scrolls away with
the page rather than sticking, so it cannot cover a short viewport. The
scroll padding assumes a **one-line** sticky header at 48rem and wider; revisit
it if the header's controls grow (the palette trigger, for example) enough to
wrap there.

**Skip link:** "Skip to main content" is the first tab stop on every signed-in
page; it moves focus to `<main>`.

**Page scaffold:** every page renders a page header — one `<h1>`, an optional
breadcrumb when the page is two or more levels deep, and a right-aligned primary
action slot — then its content. One primary action per page; everything else is
secondary or lives in a menu.

### Panes

Use **list/detail split panes** when the owner works through a list and inspects
items one at a time (an inbox, a ledger, a task list). Use a **full page** when
the detail is long, has its own sub-navigation, or is edited at length.

- Default split: list 380px, detail fills the rest. Panes are resizable by drag
  **and** by keyboard (arrow keys on the handle — [2.5.7](ACCESSIBILITY.md)).
  Sizes persist per route in `localStorage`.
- Pane minimums: list ≥ 280px, detail ≥ 480px. Below that the split stacks.
- The selected item lives in the URL, so reload and back work and a detail pane
  can be shared.
- Never nest a second split inside a detail pane. Use tabs or a full page.

### Content width

| Content                                      | Max width                           |
| -------------------------------------------- | ----------------------------------- |
| Reading text, prose, settings, a single form | `--width-prose` (72ch, ≈ 640–720px) |
| A form with side-by-side fields              | `--width-form` (880px)              |
| Tables, grids, dashboards, split panes       | Full bleed to the content padding   |

At **1280px** the shell fills the window. At **1920px** full-bleed content keeps
filling; prose and forms stay capped and sit at the content's left edge, not
centred in the window — a centred column next to a left sidebar reads as a
mistake. At **2560px** cap the whole content region at `--width-page` (1600px)
and let the surplus fall outside; a table stretched across 2400px is unreadable.

The shell caps its content region at `--width-page`; each page caps its own
prose and forms (the signed-in home uses `--width-prose`).

## Density and hierarchy

Compact density is a product decision (PRODUCT.md): **14px body text, 32px
controls and table rows**. Sizes come from the density tokens in
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#density-and-control-sizing--implemented) — never from
hand-picked heights.

- **One scan order per screen:** title → primary data → supporting detail →
  actions. The most important thing is top-left.
- Hierarchy is built from **weight, colour and spacing** before size. At 14px
  body there is little room to grow type; `text-muted-foreground` and a 500
  weight do more work than a bigger font.
- Meta text (timestamps, counts, ids) is 12–13px and muted, never bold.
- Group with **space and a rule**, not with nested cards. Cards inside cards are
  a smell at this density.
- Don't compensate for density with decoration: no drop shadows on rows, no
  gradient headers, no icon on every label.

## Keyboard model

### The command palette (Ctrl/Cmd+K) — _planned_

The palette is WorkHub's **only custom shortcut** (PRODUCT.md). The owner
explicitly declined other custom shortcuts and all single-key shortcuts.

- **Opens on Ctrl+K / Cmd+K from anywhere, including inside a text field** — the
  app claims that chord (`preventDefault`), so the browser's own Ctrl+K
  search-bar focus does not fire inside WorkHub. It is also reachable by a visible header
  button showing `⌘K` / `Ctrl K` — discoverability is not optional; a shortcut
  nobody can see does not exist.
- **What belongs in it:** navigation to every destination in the sidebar, the
  primary action of each feature, global search over the owner's data, and
  app-level commands (toggle theme, toggle sidebar, sign out).
- **What does not:** irreversible actions (they need their AlertDialog in context), anything
  that depends on the current selection in a way the palette cannot show, and
  settings that belong on a settings page.
- **Behaviour:** opens focused on its input, filters as you type, arrows move the
  highlighted item (`aria-activedescendant`, one tab stop), Enter runs it, Esc
  closes and **returns focus to where it was**. Focus is trapped while open.
- Esc closes the palette only — it never also navigates back or clears a
  selection underneath.

### Reserved keys

These must keep working on every screen. If a view swallows one, that is a bug.

| Keys                                                | Must keep doing                                                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Ctrl/Cmd + T`, `W`, `N`, `L`, `Shift+T`            | New tab, close tab, new window, address bar                                                                     |
| `Ctrl/Cmd + Tab`, `Ctrl/Cmd + 1…9`                  | Switch browser tabs                                                                                             |
| `F5`, `Ctrl/Cmd + R`                                | Reload                                                                                                          |
| `Ctrl/Cmd + F`                                      | Browser find — **unless** the view has its own in-page search, which must then be announced and Esc-dismissible |
| `Ctrl/Cmd + P`, `+`, `-`, `0`                       | Print, zoom                                                                                                     |
| `Ctrl/Cmd + C/V/X/A/Z`                              | Clipboard and undo **inside the focused field**                                                                 |
| `Tab`, `Shift+Tab`, `Esc`, `Enter`, `Space`, arrows | Standard focus and control semantics                                                                            |

**Do:** add a command to the palette. **Don't:** bind `d` to delete, `/` to
search, or `Ctrl+S` to save. Anything beyond the palette needs an owner decision
first, and if a single-character shortcut is ever accepted it must be
remappable or disableable (WCAG 2.1.4).

### Focus scopes

- **Inside a text input**, arrows, Home/End and Ctrl+A belong to the input.
  Global arrow handling must check the event target first.
- **Inside a modal dialog**, focus is trapped; Esc closes; focus returns to the
  trigger.
- **Inside a menu, popover or palette**, arrows move within, Tab closes and moves
  on, Esc closes and returns focus.
- **Nothing outside a dialog** traps focus. There is no "focus mode".

## Selection and list navigation

Lists and tables that support selection follow one pattern everywhere.

- **Roving tabindex:** the list is one tab stop. `↑`/`↓` move the active row,
  `Home`/`End` jump to first/last, `PageUp`/`PageDown` move a viewport. The
  active row is visibly distinct from the selected rows.
- **Enter** opens the active row (into the detail pane or its page). **Space**
  toggles selection when the list is selectable.
- **Mouse:** click selects one; `Shift+click` extends a range from the anchor;
  `Ctrl/Cmd+click` toggles one. Keyboard equivalents: `Shift+↑/↓` extends,
  `Ctrl/Cmd+A` selects all **within the list when the list has focus**.
- **Bulk actions** appear in a bar attached to the list (not a floating overlay)
  the moment the first item is selected, showing the count ("3 selected") and a
  clear-selection control. The bar is reachable by Tab immediately after the
  list.
- Selection survives sort and filter changes only for rows still visible;
  otherwise it is cleared and the change is announced.
- Deleting the active row moves focus to the next row
  ([ACCESSIBILITY.md](ACCESSIBILITY.md)).

## Tables and grids

One `DataTable` primitive (_planned_) — no bespoke `<table>` markup. Until it
is built, tables use the `Table` parts in `components/ui/table.tsx` (zebra and
hover rows, numeric columns, a totals footer; DESIGN_SYSTEM.md → Table).

- **Semantics:** a real `<table>` with `<th scope>`. A grid with roving focus
  uses `role="grid"` only when cells are individually focusable.
- **Column sizing:** each column declares a min width and a grow weight. Text
  columns grow, numeric and date columns are fixed and right-aligned with
  tabular numerals. Column resize is drag **and** keyboard.
- **Sticky header** while the body scrolls, with the table body owning the
  scroll — never the page. Sticky chrome must not cover the focused row.
- **Sort:** click or Enter on a header cycles ascending → descending → none, with
  `aria-sort` set and a direction arrow. Sort lives in the URL.
- **Filter:** filters sit above the table, show the active count, offer a clear
  control, and live in the URL. A filtered-empty table says so and offers "Clear
  filters", which is different from the never-had-data empty state.
- **Virtualisation:** virtualise above **~200 rows**
  ([FRONTEND_QUALITY.md](FRONTEND_QUALITY.md)). A virtualised table still has a
  correct row count for assistive technology and still supports Home/End.
- **Row states:** loading renders skeleton rows matching the final row height (no
  layout shift); empty renders a single explanatory row with the primary action;
  error renders an inline message with a retry inside the table container, not a
  toast, and keeps the header visible.
- Horizontal overflow scrolls **inside the table container**. It never scrolls
  the page.

## Feedback

| Situation                                     | Channel                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| A field is invalid                            | Inline, under the field, linked to it                                             |
| The whole view failed to load                 | Inline error region with retry, in place of the content                           |
| A mutation the owner just triggered succeeded | Toast, brief                                                                      |
| A mutation failed                             | Toast that does **not** auto-dismiss, plus inline state if the form is still open |
| A reversible delete or archive                | **Undo toast** — act immediately, offer undo                                      |
| Something irreversible                        | `AlertDialog` **before** acting                                                   |
| Background work finished                      | Toast                                                                             |

### Undo over confirm

Soft delete exists in the data model
([DATABASE.md](DATABASE.md)), so most deletes are reversible.

- **Do:** delete the row, remove it from the list optimistically, show
  "Invoice deleted · Undo" for **8 seconds** with the action keyboard-reachable.
- **Don't:** show "Are you sure?" for something you can undo. Confirmation
  dialogs for routine actions train the owner to click through them.
- Use `AlertDialog` only when the action is genuinely irreversible — permanent
  purge, sign out everywhere, a destructive migration. Its confirm button names
  the action ("Delete permanently"), never "OK".

### Timing

| Threshold  | Rule                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| 100ms      | Visible response to any input — press state, focus, value change                                     |
| 300ms      | Nothing spins before this. Under 300ms, show nothing; a flashed spinner reads as jank                |
| First load | Skeleton matching the final layout. Refetches of already-shown data never replace it with a skeleton |
| 8s         | Undo toast lifetime; success toasts 4s; error toasts persist until dismissed                         |

Every data-driven view designs **loading, empty, error, partial and success**. A
missing state is a bug.

## Overlays

Pick the lightest thing that works.

| Use                | When                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| **Tooltip**        | Naming an icon-only control. Never the only place information appears      |
| **Popover**        | A small, non-modal, dismissible extra: a date picker, a filter, a menu     |
| **DropdownMenu**   | A list of actions on a control                                             |
| **ContextMenu**    | The same actions on right-click of a row                                   |
| **Dialog** (modal) | A short focused task the owner must finish or cancel: rename, a small form |
| **AlertDialog**    | Irreversible confirmation only                                             |
| **Side panel**     | Inspecting or editing an item while the list stays visible and usable      |
| **Full page**      | Anything long, multi-step, or with its own sub-navigation                  |

Rules:

- **No nested modals.** If a dialog needs a dialog, it needed a page.
- Every overlay: Esc closes, click-outside closes (except a dialog with unsaved
  changes, which asks first), focus returns to the trigger.
- A modal traps focus; a popover does not — Tab leaves it and closes it.
- Overlays are labelled by their title and never scroll the page behind them.
- A side panel is **non-modal**: the list behind it stays keyboard-operable.
- Three or more fields, or anything the owner will consult other data for,
  belongs on a page, not in a dialog.

## Context menus and hover

- **Every right-click menu is mirrored** by a visible control: a row's "⋯" menu
  button, or the same commands on the toolbar. Right-click is an accelerator, not
  the only path.
- **Hover-revealed row actions** must appear on keyboard focus of the row too,
  and must not shift layout when they appear — reserve the space.
- Hover never carries information that is not available another way. A tooltip
  is a label, not content.

## Forms

- **Layout at 14px/32px:** label above the field, 4px gap; fields stacked in a
  single column capped at `--width-form`; related short fields may share a row
  (a date range, an amount and its date). Description text below the label, error
  text below the field.
- **Submit:** `Enter` submits a single-line form. In a multi-line field `Enter`
  inserts a newline and **`Ctrl/Cmd+Enter` submits** — label the submit button
  with that hint. This is a standard form convention scoped to the focused form,
  not a custom shortcut. The submit button shows a pending state and disables while the
  mutation runs (_planned_ — `Button` has no pending state yet; forms currently
  swap the label, as `sign-in-form.tsx` does).
- **Autosave vs explicit save:** autosave **only** for single-field, immediately
  reversible edits (inline rename, a toggle, a note), which show a quiet "Saved"
  and are undoable. Everything else is an **explicit save** with Cancel.
  Never mix the two in one form.
- **Unsaved changes:** an explicit-save form with a dirty state blocks in-app
  navigation with an AlertDialog ("Discard changes?" / "Keep editing") and
  registers a `beforeunload` handler for tab close and reload. Clear both on
  successful save.
- **Validation:** on blur and on submit, never on every keystroke. The same Zod
  schema validates in both apps (ADR-0007, ADR-0017). Input is preserved on
  failure — never lose the owner's work.
- **Errors:** per-field messages linked to the field, plus an **error summary**
  above the form listing each failure as a link to its field (_planned_ — the
  `Form` primitive does not render one yet; see BACKLOG.md). Server-side failures
  that are not field-specific render in an `Alert` at the top of the form.

## URL state

If a view can look two different ways, the URL says which. Search params are
typed and validated (ADR-0005).

**Must be in the URL:** the active list filters, the search query, sort column and
direction, pagination or cursor, the selected item in a list/detail view, the open
tab within a page, and an open dialog or side panel that represents a resource
(`?item=123`).

**Must not be:** transient UI that is not worth sharing — sidebar collapsed
state, pane sizes, column widths, a menu being open, an unsent draft. Those are
per-browser preferences ([FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)).

Back and forward must undo exactly one of those changes, and a reload must
restore the same view.

## Multiple tabs

The owner will keep WorkHub open in more than one tab.

- **Refetch on focus** is on by default (`lib/query/client.ts`), so a
  backgrounded tab is fresh when the owner returns.
- **Session expiry in a background tab:** the next request 401s; the router guard
  redirects to sign-in with a `redirect` param back to where the owner was. A
  tab must never sit showing stale data it can no longer refresh.
- **Cross-tab sign-out and theme** (_planned_): signing out or changing the theme
  in one tab should propagate to the others through a `storage` event or
  `BroadcastChannel`. Not implemented today — each tab is independent.
- Unsaved work is never discarded by a background refetch.

## Window sizes and zoom

- **Design range:** 1280px to 2560px+ wide. Verify at **1280×800** and
  **1920×1080**; check 2560px does not stretch content past `--width-page`.
- **Reflow floor:** the layout must stay usable down to **320 CSS px** wide —
  which is a 1280px window at 400% zoom, a WCAG 2.2 AA requirement (1.4.10), not
  a phone design. At the floor:
  - panes stack into a single column, sidebar in the rail state;
  - **no content or function is lost** — nothing is `display: none` unless it is
    available another way;
  - **no horizontal scrolling of the page**;
  - dialogs fill the viewport rather than overflowing it.
- **Allowed to scroll in two dimensions** inside their own container: data tables
  and grids, charts and diagrams, code blocks.
- Between 320 and 1280 CSS px the layout must not break, but it is not a design
  target — don't add breakpoints to make it pretty.

Full verification steps are in [FRONTEND_QUALITY.md](FRONTEND_QUALITY.md) and
[ACCESSIBILITY.md](ACCESSIBILITY.md).

## Copy

- **British English** (`en-GB`): organise, colour, licence (noun), maths. One
  locale, no i18n ([PRODUCT.md](PRODUCT.md#locale)).
- **Sentence case** everywhere — buttons, headings, menu items, table headers.
  Never Title Case, never ALL CAPS.
- **Controls are verbs; toasts are past tense.** The button says
  "Delete invoice"; the toast afterwards says "Invoice deleted". The button says
  "Save changes"; the toast says "Changes saved".
- **Destructive labels name the thing:** "Delete invoice", not "Delete". The
  confirm button in an AlertDialog repeats the verb, never "OK"/"Yes".
- **Errors say what happened and what to do:** "We couldn't save your changes.
  Check your connection and try again." Never a status code, a stack trace, or
  blame ("You entered an invalid value").
- **Empty states** are one line plus the primary action, and distinguish "nothing
  here yet" from "nothing matches these filters".
- **No ellipsis padding** ("Loading…" is fine; "Delete…" means a dialog follows).
- Numbers, money and dates go through the shared formatters — GBP from integer
  pence, dates in Europe/London. Never hard-code a symbol or a format.

## Definition of done (UX)

- [ ] Built from the shared shell, tokens and existing components — no one-offs
- [ ] One primary action; a coherent scan order at 14px/32px density
- [ ] Loading, empty, error, partial and success states all designed
- [ ] Fully keyboard operable; no shortcut beyond Ctrl/Cmd+K; reserved keys work
- [ ] Reversible destruction uses an undo toast; dialogs only for irreversible acts
- [ ] Filters, sort, selection and open panes are in the URL; reload restores them
- [ ] Correct in light and dark at 1280 and 1920, and usable at 400% zoom
- [ ] Copy is en-GB, sentence case, verb-labelled, past-tense in toasts
- [ ] [ACCESSIBILITY.md](ACCESSIBILITY.md) checklist passed for the parts touched
