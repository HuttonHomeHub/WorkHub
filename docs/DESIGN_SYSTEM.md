# Design System

> The token and visual specification for WorkHub. The implementation lives in
> [`apps/web/src/styles/globals.css`](../apps/web/src/styles/globals.css) and
> `apps/web/src/components/ui/`; this document is the spec and the rationale.
> Interaction rules are in [`UX_STANDARDS.md`](UX_STANDARDS.md), accessibility in
> [`ACCESSIBILITY.md`](ACCESSIBILITY.md), authoring rules in
> [`COMPONENT_LIBRARY.md`](COMPONENT_LIBRARY.md).

**No one-off component styling may ever exist.** If it is visual, it is a token
or a variant. Hex values, arbitrary Tailwind values and inline theme styles are
blocking findings (the **ui-reviewer** owns this rule).

Every entry below is marked **implemented** (in `globals.css` or a component
today) or **proposed** (agreed here, to be added by the PR that first needs it).
Nothing in this document may be cited as existing unless it says implemented.

## Principles

1. **Clarity over cleverness.** Data must be unambiguous and scannable.
2. **Compact by default.** 14px body, 32px controls and rows (PRODUCT.md).
3. **One way to do a thing.** Reuse a primitive; never reinvent one.
4. **Accessible by default** — [ACCESSIBILITY.md](ACCESSIBILITY.md) is a merge
   requirement, and tokens are chosen so components pass it without special
   cases.
5. **Themeable.** Light and dark are equals, both driven by the same tokens.
6. **Token-driven.** No magic values.

## Foundations

- **React 19** function components. Refs are ordinary props — no `forwardRef`.
- **Tailwind CSS v4, CSS-first** (ADR-0006). No `tailwind.config.js`; the theme
  is `@theme inline` in `globals.css`. Components use semantic utilities
  (`bg-primary`, `text-muted-foreground`), never raw palette values.
- **shadcn/ui on Radix**, owned as source in `components/ui/`. Variants via
  `class-variance-authority` and `cn()` (`clsx` + `tailwind-merge`).
- **Icons:** [Lucide](https://lucide.dev) only.

---

## Tokens

### Colour — implemented

Authored in **OKLCH** for perceptual uniformity and predictable light/dark pairs.
Every colour is semantic, so `.dark` on `<html>` flips the whole app. The table
records the roles; `globals.css` holds the values.

| Role                                | Light                             | Dark                         | Use                                                             |
| ----------------------------------- | --------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| `background` / `foreground`         | `oklch(1 0 0)` / `0.145`          | `oklch(0.145 0 0)` / `0.985` | Page surface and default text                                   |
| `card`, `popover` (+ `-foreground`) | same as background                | `oklch(0.205 0 0)`           | Raised surfaces, overlays                                       |
| `primary` / `-foreground`           | `oklch(0.51 0.18 255)`            | `oklch(0.65 0.17 255)`       | Primary actions, active state                                   |
| `secondary`, `accent`, `muted`      | `oklch(0.97 0 0)`                 | `oklch(0.269 0 0)`           | Secondary surfaces, hover, selection                            |
| `muted-foreground`                  | `oklch(0.556 0 0)`                | `oklch(0.708 0 0)`           | Meta text                                                       |
| `destructive`                       | `oklch(0.577 0.245 27.325)`       | `oklch(0.52 0.2 22.216)`     | Errors, destructive actions                                     |
| `success` / `warning` / `info`      | see `globals.css`                 | see `globals.css`            | Status                                                          |
| `border` / `input`                  | `oklch(0.922 0 0)`                | `oklch(1 0 0 / 10%)` / `15%` | Lines, field borders                                            |
| `ring`                              | = `primary`                       | = `primary`                  | Focus indicator                                                 |
| `chart-1…5`                         | blue, teal, green, amber, magenta | brightened                   | Categorical series                                              |
| `sidebar*`                          | `oklch(0.985 0 0)` surface        | `oklch(0.205 0 0)`           | Navigation shell: the sidebar (`components/layout/sidebar.tsx`) |

**Rules:**

- Re-verify every solid fill / foreground pair against WCAG AA in **both** themes
  when you touch a colour token. Measure, don't eyeball
  ([ACCESSIBILITY.md](ACCESSIBILITY.md#how-to-verify)).
- Status is never colour alone — pair with an icon or text.
- **Open question:** `--border`, `--input` and `--sidebar-border` are the tokens most likely to fail
  1.4.11 (3:1 for control boundaries), in both themes. They have **not** been
  measured. Treat them as suspect and fix them before claiming compliance
  ([TECH_DEBT.md](TECH_DEBT.md), [BACKLOG.md](BACKLOG.md)).

### Dark-mode quality rules

Dark mode is not an inversion.

- **Elevation comes from surface lightness, not shadow.** Page
  `oklch(0.145)` → card/popover `oklch(0.205)` → hovered/selected
  `oklch(0.269)`. Shadows barely read on dark surfaces; a lighter surface does.
- **Borders and inputs are translucent white** in dark (`/10%`, `/15%`) so they
  sit correctly on any surface — but translucency makes contrast depend on what
  is behind, so measure on the darkest surface it will appear on.
- **Reduce chroma, raise lightness** for saturated colours in dark: `primary`
  moves from `0.51 0.18` to `0.65 0.17`, `destructive` from `0.577 0.245` to
  `0.52 0.2`. Never reuse a light-theme accent unchanged.
- Foregrounds on coloured fills flip: `primary-foreground` is near-white in
  light and near-black in dark.
- Pure `#000` backgrounds and pure `#fff` text are banned — both are already
  avoided by using `oklch(0.145)` and `oklch(0.985)`.

### Typography

**Family — implemented, with a gap.** `--font-sans` is
`'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, …` and
`--font-mono` is `ui-monospace, 'JetBrains Mono', …`. **No web font is loaded** —
neither `index.html` nor `globals.css` fetches Inter or JetBrains Mono, so the
app renders in the system UI font. Decide and act: either self-host Inter
(subset, `woff2`, `font-display: swap`, preloaded) or drop `'Inter'` from the
stack and specify the system stack honestly. Tracked in
[BACKLOG.md](BACKLOG.md); until then, do not describe WorkHub as "set in Inter".

**Desktop type scale — proposed.** 14px body (PRODUCT.md), which makes
Tailwind's `text-base` (16px) the wrong default. Use these steps only.

| Step         | Size / line-height | Weight  | Use                                          |
| ------------ | ------------------ | ------- | -------------------------------------------- |
| `text-meta`  | 12px / 16px        | 400/500 | Timestamps, counts, ids, table sub-labels    |
| `text-small` | 13px / 18px        | 400     | Dense secondary text, help text              |
| `text-body`  | **14px / 20px**    | 400     | Body, table cells, inputs, buttons — default |
| `text-lead`  | 16px / 24px        | 400     | Lead paragraph, empty-state explanation      |
| `text-h3`    | 16px / 24px        | 600     | Card and section titles                      |
| `text-h2`    | 20px / 28px        | 600     | Section headings                             |
| `text-h1`    | 24px / 32px        | 600     | Page title                                   |

- **Weights:** 400 body, 500 labels/buttons/active nav, 600 headings. Nothing
  heavier.
- Headings above 24px do not earn their space at this density. A page title is
  24px, not 30px.
- **One `<h1>` per page**, levels never skip.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) are **required** on
  any column of numbers — amounts, counts, durations, ids — so digits align down
  the column. Proposed as a `.tabular` utility applied by `DataTable` for numeric
  columns; prose keeps proportional figures.
- **Today:** components use Tailwind's `text-sm` (14px) for body and `text-lg`
  (18px) / `text-2xl` (24px) for titles. Adopting the scale above is part of the
  app-shell work in PRODUCT.md's Next list.

### Spacing — implemented

Tailwind's 4px base: `1`=4 `2`=8 `3`=12 `4`=16 `6`=24 `8`=32 `12`=48. Scale steps
only, no arbitrary values.

At compact density the rhythm is tighter than a marketing site: **`2` inside a
control, `3`–`4` between fields, `6` between groups, `8` between page sections.**
Page padding is `6` (24px) at 1280px and above.

### Density and control sizing — proposed

The single most important change from the generic starter: **32px, not 36px.**

| Token                      | Value | Applies to                                           |
| -------------------------- | ----- | ---------------------------------------------------- |
| `--control-sm`             | 28px  | Toolbar buttons inside a dense table                 |
| `--control-md`             | 32px  | **Default** — buttons, inputs, selects, menu items   |
| `--control-lg`             | 40px  | The one prominent action on an empty state or dialog |
| `--row-height`             | 32px  | Table and list rows                                  |
| `--row-height-comfortable` | 40px  | Rows with two lines of content                       |
| `--icon-button`            | 32px  | Square icon-only buttons                             |
| `--header-height`          | 48px  | App header (**implemented**, see Layout)             |

- 32px still satisfies WCAG 2.5.8 (24×24 CSS px) with room to spare; the focus
  ring and padding are what must not shrink.
- **Today:** `button.tsx` defaults to `h-9` (36px) with `sm` at `h-8` (32px), and
  `input.tsx` is fixed at `h-9`. Retuning the defaults to 32px, and giving
  `Input` the same size variants as `Button`, is **later** app-shell work
  (PRODUCT.md → Next, "App shell: density tokens"). The hours tracker's slice 1
  did not do it: the header's icon buttons (sidebar toggle, theme) are still
  36px until that retune lands.

### Layout — partly implemented

Prose widths and pane sizes are decisions, not ad-hoc classes
([UX_STANDARDS.md](UX_STANDARDS.md#app-shell)). Implemented tokens are plain
custom properties on `:root`, used as `w-(--sidebar-width)` or
`max-w-(--width-prose)`.

| Token                 | Value  | Meaning                                       | Status      |
| --------------------- | ------ | --------------------------------------------- | ----------- |
| `--sidebar-width`     | 240px  | Expanded sidebar                              | implemented |
| `--sidebar-rail`      | 56px   | Collapsed icon rail                           | implemented |
| `--header-height`     | 48px   | Sticky header, and the page's scroll padding  | implemented |
| `--width-prose`       | 72ch   | Reading text and single-column settings       | implemented |
| `--width-form`        | 880px  | Forms with side-by-side fields                | implemented |
| `--width-page`        | 1600px | Cap for the whole content region above 2560px | implemented |
| `--width-toast`       | 24rem  | The toaster's width                           | implemented |
| `--pane-list-min`     | 280px  | List pane minimum                             | proposed    |
| `--pane-list-default` | 380px  | List pane default                             | proposed    |
| `--pane-detail-min`   | 480px  | Detail pane minimum, below which panes stack  | proposed    |

**Sidebar variant — implemented.** `globals.css` defines one custom variant
for the shell, driven by `data-sidebar` on `<html>` (set before first paint):

`sidebar-rail:` applies when the sidebar is collapsed, **or** at any width
below 48rem (Tailwind's `md`; a 1280px window reaches it at 200% zoom), where
the sidebar is always the rail. Use it only inside the shell, for the rail's
width and its hidden labels. The rail tooltips open only in the rail state,
checked in JavaScript when they would open (`isSidebarRail()` in `sidebar.tsx`
mirrors the variant), so an expanded link never carries a description.

### Z-index — partly implemented

Six levels, defined once. Never write a numeric `z-` utility at a call site; use
`z-(--z-header)`.

| Token         | Value | Layer                                                   | Status      |
| ------------- | ----- | ------------------------------------------------------- | ----------- |
| `--z-base`    | 0     | Page content                                            | proposed    |
| `--z-sticky`  | 10    | Sticky table headers, pane handles                      | proposed    |
| `--z-header`  | 20    | App header and sidebar                                  | implemented |
| `--z-popover` | 40    | Dropdowns, popovers, tooltips, context menus, skip link | implemented |
| `--z-modal`   | 50    | Dialogs, AlertDialogs, the palette, their overlays      | proposed    |
| `--z-toast`   | 60    | Toaster — always above a dialog                         | implemented |

### Motion — proposed as CSS variables

Durations and easings exist only as prose today; components hard-code Tailwind
`transition-colors`. Define them once so they can be tuned in one place.

| Token             | Value                           | Use                              |
| ----------------- | ------------------------------- | -------------------------------- |
| `--duration-fast` | 120ms                           | Hover, press, colour changes     |
| `--duration-base` | 180ms                           | Popovers, menus, toasts entering |
| `--duration-slow` | 240ms                           | Dialogs, panes, the palette      |
| `--ease-out`      | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances                        |
| `--ease-in`       | `cubic-bezier(0.4, 0, 1, 1)`    | Exits                            |
| `--ease-in-out`   | `cubic-bezier(0.4, 0, 0.2, 1)`  | Movement and resizing            |

Motion communicates state or continuity; it is never decoration. Layout-shifting
animation on list rows is banned — it makes a dense table unreadable.
`prefers-reduced-motion` collapses everything to near-instant (**implemented**,
globally in `globals.css`).

### Focus ring — implemented, needs unifying

`--ring` is `primary` in both themes, and `globals.css` sets a global
`outline-ring/50`. But components disagree: `Button` uses
`focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`, while
`Input` uses `focus-visible:ring-2 ring-ring` with no offset.

**Spec (proposed):** one `--focus-ring` definition — 2px `ring` plus a 2px
`background` offset — applied identically by every interactive primitive, on
`:focus-visible` only.

- The ring must clear 3:1 against **both** the control and the surface behind it
  (1.4.11); the offset is what guarantees the second.
- Never `outline: none` without an equivalent indicator.
- On a `primary`-filled button the ring is the same colour as the fill, so the
  offset ring is the only thing that separates them — it is not optional.

### Border radius — implemented

One base `--radius: 0.625rem` (10px) derives `radius-sm` (6px), `radius-md`
(8px), `radius-lg` (10px), `radius-xl` (14px). Inputs and buttons use `md`,
dialogs `lg`, cards `xl`, avatars and pills `full`. At compact density, table
rows and menu items stay square or `sm`.

### Elevation — implemented

| Level | Token         | Use                                       |
| ----- | ------------- | ----------------------------------------- |
| 0     | `shadow-none` | Table rows, flush surfaces                |
| 1     | `shadow-sm`   | Cards                                     |
| 2     | `shadow-md`   | Dropdowns, popovers, context menus        |
| 3     | `shadow-lg`   | Dialogs, side panels, the command palette |

Prefer border + level 1 in light; prefer a lighter **surface** over a shadow in
dark (see dark-mode rules). Never stack heavy shadows.

### Iconography — implemented

Lucide only. `size={16}` inline (the default at 14px body), `20` standalone;
`1.5`–`2px` stroke; `currentColor`. Interactive icons need an accessible name;
decorative icons are `aria-hidden`.

### Scrollbars and selection — proposed

- Style scrollbars to the theme (`scrollbar-width: thin`,
  `scrollbar-color: var(--border) transparent`) so a dark app does not show a
  light scrollbar. Never hide a scrollbar that indicates scrollable content.
- **Scroll containment:** panes and table bodies own their scroll; the page
  itself scrolls only when the content is a single column.
- Text selection uses `accent` with `accent-foreground`, so selected text stays
  readable in both themes.
- Row selection is a **surface** change (`accent`) plus a left marker bar, not a
  colour-only cue.

### Themes — implemented

Light, dark and system. In the dark theme, native form controls (inputs and selects) take
`color-scheme: dark`, so date pickers and select popups match it. It is
scoped to the controls: set on the root, it restyled the whole page and
briefly mixed old and new colours when the theme flipped. The preference is stored in `localStorage` and applied as
`.dark` on `<html>`; an inline script in `index.html` sets it before first paint
so there is no flash. Components never branch on theme in JS — tokens flip.

**Today the header control is a two-way toggle** (`app-shell.tsx` switches
light ⇄ dark and drops `system`), although `useTheme` already supports all three.
A three-way control is in PRODUCT.md's Next list.

### What is deliberately not a token

Breakpoints for phones and tablets, finger-sized hit areas, and locale/currency
formats. WorkHub is a desktop app with one locale; formatting rules live in
[PRODUCT.md](PRODUCT.md#locale) and the shared formatters, and layout behaviour
below 1280px is the reflow floor in
[UX_STANDARDS.md](UX_STANDARDS.md#window-sizes-and-zoom), not a breakpoint set.

---

## Component specs

Authoring rules — naming, props, refs, tests — are in
[COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md). Each component ships typed props,
every interaction state, light + dark correctness, its documented keyboard
contract and a test.

### Implemented

| Component        | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**       | Variants `default \| secondary \| outline \| ghost \| destructive \| link`; sizes `sm \| default \| lg \| icon`; `wrap` lets a long label wrap (height grows from the size's) so it reflows at 320 CSS px. One primary per view; icon-only needs `aria-label`. **Missing:** a pending state (spinner + `disabled` + `aria-busy`) — forms swap the label instead (BACKLOG.md).                                                                                                                                                           |
| **Input**        | `h-9` today (→ 32px), `border-input`, `aria-invalid:border-destructive`, focus ring. **Missing:** size variants matching `Button`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Label**        | Radix label, 14px/500, `peer-disabled` styling. Always bound to a control.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Card**         | `card` surface, `radius-xl`, `shadow-sm`, `p-6`. Slots: `CardHeader`/`CardTitle` (`<h2>`)/`CardDescription`/`CardContent`/`CardFooter`. At compact density, `p-4` is the better default — revisit with the density retune.                                                                                                                                                                                                                                                                                                              |
| **Alert**        | `role="alert"`, variants `default \| destructive`, with `AlertTitle`/`AlertDescription`. Used for view- and form-level errors.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Tooltip**      | `@radix-ui/react-tooltip`: `TooltipProvider` (once, in `AppShell`, 400ms delay), `Tooltip`, `TooltipTrigger`, `TooltipContent` (`popover` surface, border, `shadow-md`, 12px, `--z-popover`, portalled). Names icon-only controls; opens on hover **and** focus; Esc closes; never the only place information lives.                                                                                                                                                                                                                    |
| **Form**         | React Hook Form + Zod (ADR-0007): `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormDescription`/`FormMessage`, wiring ids, `aria-describedby` and `aria-invalid`. **Missing:** the error summary and first-invalid-field focus that FRONTEND_ARCHITECTURE and ADR-0007 describe (BACKLOG.md).                                                                                                                                                                                                                               |
| **Tabs**         | `@radix-ui/react-tabs`: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`. Controlled from the URL (`?tab=`). The list is one tab stop; ←/→ move and activate, Home/End; the panel is focusable. Selected tab: 2px `primary` underline and a 500 weight, not colour alone. Only the open panel renders. The list wraps at the reflow floor.                                                                                                                                                                                                 |
| **Switch**       | `@radix-ui/react-switch`: `role="switch"` with `aria-checked`; 36×20 track, `primary` when on, a `muted-foreground` outline and thumb when off (the thumb's position also shows the state). Space/Enter toggle. A switch that saves by itself shows a quiet "Saved" in a `role="status"` beside it; in an explicit-save form it is a field.                                                                                                                                                                                             |
| **Toast**        | `@radix-ui/react-toast`: one `Toaster` (in `AppShell`, after `<main>`), bottom-right, `--z-toast`, `--width-toast`, `popover` surface, `shadow-md`; raised with `toast({ title, description?, variant?, action? })`. Variants `success \| error \| info`, each with an icon. Success and info 4s, **undo (a toast with an action) 8s**, errors persist until dismissed. Announced politely; never takes focus; Tab reaches the action and the dismiss button; timers pause on focus and hover; Esc dismisses. Radix's F8 hotkey is off. |
| **Skeleton**     | A `muted` block with a pulse (none under reduced motion), `aria-hidden`; the loading region carries `aria-busy` and a text alternative. Sized to the final layout; shown only after 300ms (`useDelayedFlag`), on first load, never on a refetch.                                                                                                                                                                                                                                                                                        |
| **NativeSelect** | A native `<select>` styled like `Input`, with a chevron. For short fixed option lists; the browser supplies the popup, typeahead and screen-reader support.                                                                                                                                                                                                                                                                                                                                                                             |

### Planned

Build these when the first feature needs them, to this spec, wrapping any
third-party headless library as an owned primitive in `components/ui/`.

| Component                                              | Spec                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kbd**                                                | Renders a shortcut (`⌘K` / `Ctrl K`) in `font-mono` at `text-meta` with a bordered chip. Used in the palette trigger and menu items.                                                                                                                              |
| **DropdownMenu / ContextMenu**                         | Radix. Arrow keys, typeahead, Esc, focus return. Every context menu is mirrored by a visible "⋯" button (UX_STANDARDS.md).                                                                                                                                        |
| **Dialog / AlertDialog**                               | Radix modal: focus trap, Esc, focus return, labelled by title, scroll lock. `AlertDialog` **only** for irreversible actions; its confirm button names the action.                                                                                                 |
| **Command palette**                                    | `cmdk` wrapped as a primitive. Ctrl/Cmd+K, filter-as-you-type, `aria-activedescendant`, grouped results, Esc returns focus. See UX_STANDARDS.md.                                                                                                                  |
| **DataTable**                                          | TanStack Table wrapped as a primitive: column min-width + grow, sticky header, sort with `aria-sort`, filters, row selection with roving tabindex, virtualisation above ~200 rows, tabular numerals on numeric columns, skeleton/empty/filtered-empty/error rows. |
| **Resizable panels**                                   | `react-resizable-panels` wrapped as a primitive: drag **and** arrow-key resize on the handle (2.5.7), min sizes from the layout tokens, sizes persisted per route.                                                                                                |
| **Inspector / side panel**                             | Non-modal right panel over the detail area; Esc closes; the list behind stays operable. Not a modal and never an overlay.                                                                                                                                         |
| **Badge, Breadcrumb, Pagination, Search, Empty state** | As needed, to the same bar: token-driven, keyboard-complete, states covered, no colour-only meaning.                                                                                                                                                              |

---

## Governance

- A token change changes the whole app: note it here in the same PR, and
  re-measure contrast for any colour you touch.
- A new shared pattern is added here and built in `components/ui/`, never inlined
  at a call site.
- Third-party headless libraries are wrapped as owned primitives so app code
  never imports them directly (COMPONENT_LIBRARY.md).
- The **ui-reviewer** agent enforces the no-one-off-styling rule; the
  **accessibility-reviewer** enforces [ACCESSIBILITY.md](ACCESSIBILITY.md).
