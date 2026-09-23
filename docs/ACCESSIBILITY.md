# Accessibility

> The single canonical home of WorkHub's accessibility rules. **WCAG 2.2 AA is a
> merge requirement** ([PRODUCT.md](PRODUCT.md#accessibility), ADR-0019): a
> failure blocks a PR the same way a failing test does, and a gate is never
> weakened to get green.

Desktop-only does not relax anything. WorkHub has one owner, but the owner may
one day use it with a keyboard only, at 400% zoom, or with a screen reader, and
the browser's own accessibility features must keep working.

Two things are **out of scope** because the product is: hit-target sizing for
fingers (no touch design — 2.5.8's 24×24 CSS px minimum still applies to pointer
targets) and language switching (one locale, `en-GB`).

## How to verify

Five checks cover almost everything below. Name the ones you ran, and the ones
you did not, in the PR body.

| Check                   | How                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Automated (axe)**     | `expectNoA11yViolations(page)` (`apps/web/e2e/support.ts`) in a Playwright journey — tags `wcag2a wcag2aa wcag21a wcag21aa wcag22aa` |
| **Lint**                | `pnpm lint` runs `eslint-plugin-jsx-a11y`; violations fail CI                                                                        |
| **Keyboard-only pass**  | Unplug the mouse. Tab through the whole screen, operate every control, open and close every overlay, and watch where focus goes      |
| **400% zoom**           | Browser zoom to 400% at a 1280×800 window (≈ 320 CSS px wide), or resize the viewport to 320×800 — see **Reflow** below              |
| **Contrast**            | Measure the rendered colours (DevTools colour picker, or an OKLCH-aware contrast tool) in **both** themes — do not eyeball it        |
| **Screen-reader smoke** | NVDA on Windows or Orca on Linux: read the page top to bottom, then operate the changed control                                      |

Automated tools catch roughly a third of real failures. The keyboard pass is the
one that catches the rest — do it for every interactive change.

## Checklist

### Structure and semantics

- [ ] **Native elements first**; ARIA only where HTML has no equivalent. A `div`
      is never a button. (4.1.2)
- [ ] **One `<h1>` per page**, heading levels never skip. (1.3.1)
- [ ] **Landmarks:** `<header>`, `<nav>`, `<main>`, and a labelled `<nav>` per
      navigation region when there is more than one. (1.3.1)
- [ ] **Skip link** (or an equivalent bypass) so the sidebar can be skipped on
      every page. The app shell's "Skip to main content" does this for signed-in
      pages. (2.4.1)
- [ ] Page `<title>` and the `<h1>` describe the view. (2.4.2)
- [ ] Reading and DOM order match the visual order. (1.3.2)

### Keyboard

- [ ] Everything operable by pointer is operable by keyboard, in a logical
      order. (2.1.1)
- [ ] **No keyboard traps** — the only trap is an open modal dialog, which Esc
      releases. (2.1.2)
- [ ] **No single-character shortcuts.** Ctrl/Cmd+K (the command palette) is the
      only custom shortcut, and modified keys are exempt. Currently **N/A**; if a
      single-key shortcut is ever added it must be remappable or disableable.
      (2.1.4)
- [ ] Standard browser and OS keys keep working — see
      [UX_STANDARDS.md](UX_STANDARDS.md#keyboard-model) for the reserved list.
- [ ] Lists, grids and the command palette use **roving `tabindex`** (one tab
      stop, arrows move within) or **`aria-activedescendant`** — never one tab
      stop per row. (2.1.1, 4.1.2)
- [ ] Menus, tabs and listboxes follow the WAI-ARIA Authoring Practices keyboard
      pattern for their role.

### Focus

- [ ] A **visible focus indicator** on every focusable element, meeting 3:1
      against its background and not removed anywhere. (2.4.7, 1.4.11)
- [ ] **Focus is never obscured** by the sticky header, a pane edge or a toast —
      scroll-padding or equivalent keeps the focused element fully visible.
      (2.4.11)
- [ ] **Focus returns to the trigger** when a dialog, popover, menu or side panel
      closes. (2.4.3)
- [ ] **After a route change**, focus moves to the new page's heading or main
      landmark rather than staying on a link that no longer exists. (2.4.3)
      `lib/route-focus.ts` does this once, from the root route: when an in-app
      navigation changes the **pathname**, focus moves to `<main>`, or to the
      first heading on a page without one. It never moves focus on the initial
      page load, or when only search params or the hash change (a `?week=`
      control keeps its focus).
- [ ] **After deleting the focused row**, focus moves to the next row (or the
      list container if the list is now empty) — never to `<body>`. (2.4.3)
- [ ] No focus change on its own triggers a context change. (3.2.1)

### Forms

- [ ] Every control has a **programmatic label** (`<Label htmlFor>` via the
      `Form` primitive); placeholders are not labels. (1.3.1, 3.3.2)
- [ ] Errors are **linked** with `aria-describedby` and marked `aria-invalid`,
      and say what to do next. (3.3.1, 3.3.3)
- [ ] The **first invalid field is focused** on submit, and an error summary
      lists the failures. (3.3.1 — summary _planned_, see BACKLOG.md)
- [ ] `autocomplete` is set on fields that ask for the user's own data. (1.3.5)
- [ ] Nothing the user entered is redundantly re-entered in the same flow.
      (3.3.7)
- [ ] Authentication needs no cognitive function test with no alternative —
      password managers and paste must work. (3.3.8)

### Status messages and feedback

- [ ] Toasts, save confirmations, validation summaries and "loaded" messages are
      announced through a **polite live region without moving focus**. (4.1.3)
- [ ] An **undo toast's action is keyboard-reachable before the toast times
      out** — either the toast is focusable in the tab order or the timeout
      pauses on focus/hover. Auto-dismiss never applies to an error. (4.1.3,
      2.2.1)
- [ ] Loading and busy states expose `aria-busy` or a live-region message, not
      only a spinner graphic. (4.1.3)

### Colour and contrast

- [ ] Body text ≥ 4.5:1; large text (≥ 24px, or ≥ 19px bold) ≥ 3:1. (1.4.3)
- [ ] **Non-text contrast ≥ 3:1** for focus rings, control borders, input
      borders, and icons that carry meaning. (1.4.11)
- [ ] Meaning is never carried by colour alone — pair with an icon, text or
      shape. (1.4.1)
- [ ] Correct in **light and dark**; check both.

> **Control boundaries use `--input`.** It is `oklch(0.63 0 0)` in light and
> `oklch(0.56 0 0)` in dark: at least 3:1 (1.4.11) against the background,
> card and muted surfaces in both themes, and
> `apps/web/src/styles/tokens-contrast.test.ts` fails if a change drops it
> below. `--border` and `--sidebar-border` draw dividers and surfaces, which
> 1.4.11 does not cover: never make them a control's only boundary.

### Zoom and reflow

- [ ] **Reflow (1.4.10):** at 400% zoom in a 1280 CSS px window — a **320 CSS px
      viewport** — no content or function is lost and there is **no
      two-dimensional scrolling of the page**. Panes stack into one column, the
      sidebar collapses, dialogs fill the viewport.
- [ ] **Allowed exceptions** (they may scroll in both directions, but inside
      their own container, never the page): data tables and grids, diagrams,
      charts, code blocks, and images of text-heavy content.
- [ ] **Text resize (1.4.4):** at 200% text-only zoom nothing clips or overlaps.
      The root font size is never locked in `px`
      (`apps/web/src/styles/globals.css` sets `text-size-adjust: 100%`).
- [ ] **Text spacing (1.4.12):** increased line height, letter and word spacing
      clip nothing.

### Pointer, motion and timing

- [ ] **Dragging alternatives (2.5.7):** anything draggable — resizable panes,
      reorderable rows, column resizing — has a single-pointer and keyboard
      alternative (arrow keys on the handle, a menu item, or a numeric input).
- [ ] **Target size (2.5.8):** pointer targets are ≥ 24×24 CSS px, or spaced so
      a 24px circle around each does not overlap a neighbour.
- [ ] No hover-only or focus-only content that cannot be dismissed, hovered or
      kept open. (1.4.13)
- [ ] `prefers-reduced-motion` is honoured (already global in `globals.css`);
      nothing auto-animates for more than 5s without a control. (2.3.3, 2.2.2)
- [ ] No time limit on a task without a way to extend it; session expiry is
      handled by re-authentication that preserves work. (2.2.1)

## Where the rules live

This document owns the accessibility rules. Related standards:

- Interaction, keyboard model and overlay behaviour:
  [UX_STANDARDS.md](UX_STANDARDS.md)
- Tokens, focus-ring spec and contrast pairs: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
- Per-component keyboard contracts: [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md)
- The test matrix and where checks run: [FRONTEND_QUALITY.md](FRONTEND_QUALITY.md),
  [TESTING.md](TESTING.md)
- Review: the **accessibility-reviewer** agent
  ([`.claude/agents/accessibility-reviewer.md`](../.claude/agents/accessibility-reviewer.md))
  audits interactive UI. Any AA failure it finds is blocking.
