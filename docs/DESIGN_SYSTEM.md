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
The 2026-09 refresh that implemented most of it is recorded in
[features/app-shell-refresh.md](features/app-shell-refresh.md).

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
records the roles; `globals.css` holds the values, each a literal `oklch()` so
the contrast test can read it. The palette and its reasoning are in
[features/app-shell-refresh.md](features/app-shell-refresh.md#palette).

| Role                                         | Light                                      | Dark                                  | Use                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `background` / `foreground`                  | `0.984 0.003 265` / `0.2 0.018 265`        | `0.16 0.006 265` / `0.955`            | The page (a step below cards) and default text                                                                                                  |
| `card`, `popover` (+ `-foreground`)          | white                                      | `0.198` / `0.225`                     | Raised surfaces, overlays: lighter is higher in dark                                                                                            |
| `primary` / `-foreground`                    | indigo `0.5 0.2 268`                       | `0.7 0.14 268`                        | The accent: primary actions, active state, links, the ring                                                                                      |
| `secondary`, `accent`, `muted`               | `0.955`–`0.962`, slate                     | `0.25`–`0.262`, slate                 | Secondary surfaces, hover, wells                                                                                                                |
| `muted-foreground`                           | `0.49 0.018 265`                           | `0.72 0.014 265`                      | Meta text, column headers                                                                                                                       |
| `table-stripe` / `table-hover` / `highlight` | `0.981` / `0.964` / `0.962 0.022 268`      | `0.213` / `0.243` / `0.245 0.032 268` | Zebra rows, the hovered row, the current row and selection                                                                                      |
| `timeline-upcoming`                          | `0.62 0.13 268`                            | `0.55 0.1 268`                        | A day still to come on the week's timeline (3:1 on `muted`)                                                                                     |
| `destructive`, `success`, `warning`, `info`  | solid fills with a `-foreground`           | re-tuned                              | Filled status: buttons, the progress bar, the switch                                                                                            |
| `…-soft` / `…-text` (each status)            | a tinted fill / a text colour              | re-tuned                              | Status chips (`Badge`), alerts, flexi, field errors                                                                                             |
| `border` / `input`                           | `0.915` / `0.63 0.012 265`                 | `1 0 0 / 9%` / `0.57 0.012 265`       | Dividers / control boundaries                                                                                                                   |
| `ring`                                       | = `primary`                                | = `primary`                           | Focus indicator                                                                                                                                 |
| `chart-1…5`                                  | indigo, teal, green, amber, magenta        | brightened                            | Categorical series                                                                                                                              |
| `sidebar*`                                   | `0.24 0.05 272` deep indigo, `0.32` accent | `0.2 0.04 272`, `0.28` accent         | Navigation shell: the sidebar (`components/layout/sidebar.tsx`), dark in both themes, with its own `sidebar-ring` (the `sidebar-scope` utility) |

**Rules:**

- Every fill/foreground pair is measured in **both** themes by
  `apps/web/src/styles/tokens-contrast.test.ts` (text 4.5:1 on every surface it
  appears on; control boundaries, the ring and state fills 3:1), with a general
  OKLCH → sRGB conversion. Add a pair there when you add a colour
  ([ACCESSIBILITY.md](ACCESSIBILITY.md#how-to-verify)).
- Status is never colour alone — pair with an icon or text. **Flexi** is
  `success-text` over, `warning-text` under, the text colour when level, always
  with its sign and word (`FlexiValue`).
- Status text uses the `-text` token, never the solid fill: `text-warning` on a
  light surface fails contrast; `text-warning-text` passes.
- **Control boundaries:** `--input` (Input, NativeSelect, the outline Button)
  is at least 3:1 against every surface a control sits on in both themes.
  `--border` and `--sidebar-border` are for dividers only
  ([ACCESSIBILITY.md](ACCESSIBILITY.md)).

### Dark-mode quality rules

Dark mode is not an inversion.

- **Elevation comes from surface lightness, not shadow.** Page
  `oklch(0.16)` → card `oklch(0.198)` → popover `oklch(0.225)` →
  hovered/selected `oklch(0.243–0.262)`. Shadows barely read on dark surfaces;
  a lighter surface does.
- **Borders and inputs are translucent white** in dark (`/10%`, `/15%`) so they
  sit correctly on any surface — but translucency makes contrast depend on what
  is behind, so measure on the darkest surface it will appear on.
- **Reduce chroma, raise lightness** for saturated colours in dark: `primary`
  moves from `0.5 0.2` to `0.7 0.14`; each status's `-text` rises to 0.76–0.85.
  Never reuse a light-theme accent unchanged.
- Foregrounds on coloured fills flip: `primary-foreground` is near-white in
  light and near-black in dark.
- Pure `#000` backgrounds and pure `#fff` text are banned — both are already
  avoided by using `oklch(0.16)` and `oklch(0.955)`.

### Typography — implemented

**Family.** `--font-sans` is `'Inter Variable'`, self-hosted from
`@fontsource-variable/inter` (imported in `main.tsx`; the weight axis only).
The browser downloads just the subsets a page uses — latin is 48 kB of woff2,
cached after the first visit — with `font-display: swap` and the system stack as
the fallback. `cv11` (the single-storey "a") is on. `--font-mono` is the system
monospace stack.

**Desktop type scale.** 14px body (PRODUCT.md). Use these steps only; they are
utilities in `globals.css` (`@theme`), and `cn()` knows them as font sizes.

| Step          | Size / line-height | Weight  | Use                                                   |
| ------------- | ------------------ | ------- | ----------------------------------------------------- |
| `text-meta`   | 12px / 16px        | 400/500 | Timestamps, counts, tags, table sub-labels            |
| `text-small`  | 13px / 18px        | 400     | Dense tables, help text, column headers, descriptions |
| `text-body`   | **14px / 20px**    | 400     | Body, inputs, buttons — the default                   |
| `text-lead`   | 16px / 24px        | 400/500 | Lead paragraph, an empty state's sentence             |
| `text-h3`     | 15px / 22px        | 600     | Card and section titles                               |
| `text-h2`     | 18px / 28px        | 600     | Section headings, a dialog's title, stat figures      |
| `text-h1`     | 24px / 32px        | 600     | Page title (−0.02em tracking)                         |
| `text-figure` | 28px / 36px        | 600     | A headline figure in a `StatTile` (−0.02em tracking)  |

- **Weights:** 400 body, 500 labels/buttons/active nav, 600 headings. Nothing
  heavier (the brand tile's letter is the one exception).
- Headings above 24px do not earn their space at this density; `text-figure` is
  for numbers in a `StatTile`, never a heading.
- **One `<h1>` per page** (the `PageHeader`), levels never skip.
- **Tabular numerals** (`tabular-nums`) are **required** on any column of
  numbers — durations, amounts, counts, dates in a column. `Table`'s `numeric`
  cells apply them, right-aligned.

### Spacing — implemented

Tailwind's 4px base: `1`=4 `2`=8 `3`=12 `4`=16 `6`=24 `8`=32 `12`=48. Scale steps
only, no arbitrary values.

At compact density the rhythm is tighter than a marketing site: **`2` inside a
control, `3`–`4` between fields, `6` between groups, `8` between page sections.**
Page padding is `6` (24px) at 1280px and above.

### Density and control sizing — implemented

**32px, not 36px.** Tokens in `globals.css`, in rem so they follow the
owner's text size; use them as `h-(--control-md)`.

| Token                      | Value | Applies to                                                  |
| -------------------------- | ----- | ----------------------------------------------------------- |
| `--control-sm`             | 28px  | Controls inside a dense table row (the week's fields, Save) |
| `--control-md`             | 32px  | **Default** — buttons, inputs, selects, menu items          |
| `--control-lg`             | 40px  | The one prominent action on an empty state; tabs            |
| `--row-height`             | 32px  | The minimum table and list row                              |
| `--row-height-comfortable` | 40px  | Rows with two lines of content, loading rows                |
| `--icon-button`            | 32px  | Square icon-only buttons (`size="icon"`; `icon-sm` is 28px) |
| `--header-height`          | 48px  | App header (see Layout)                                     |

- 28px still satisfies WCAG 2.5.8 (24×24 CSS px); the focus ring and padding
  are what must not shrink.
- `Button`, `Input` and `NativeSelect` share `size="sm" | "default" | "lg"`.

### Layout — partly implemented

Prose widths and pane sizes are decisions, not ad-hoc classes
([UX_STANDARDS.md](UX_STANDARDS.md#app-shell)). Implemented tokens are plain
custom properties on `:root`, used as `w-(--sidebar-width)` or
`max-w-(--width-prose)`.

| Token                   | Value   | Meaning                                                                                                                     | Status      |
| ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `--sidebar-width`       | 224px   | Expanded sidebar                                                                                                            | implemented |
| `--sidebar-rail`        | 56px    | Collapsed icon rail                                                                                                         | implemented |
| `--header-height`       | 48px    | Sticky header, and the page's scroll padding                                                                                | implemented |
| `--width-prose`         | 72ch    | Reading text and single-column settings                                                                                     | implemented |
| `--width-form`          | 880px   | Forms with side-by-side fields                                                                                              | implemented |
| `--width-page`          | 1600px  | Cap for the whole content region above 2560px                                                                               | implemented |
| `--width-toast`         | 24rem   | The toaster's width                                                                                                         | implemented |
| `--width-dialog`        | 28rem   | An AlertDialog's width (full width below it)                                                                                | implemented |
| `--width-aside`         | 15.5rem | A page's side column, beside the content from a 56rem content width (container query); below it otherwise                   | implemented |
| `--width-aside-wide`    | 20rem   | The same column from an 80rem content width                                                                                 | implemented |
| `--width-data-card`     | 80rem   | The most a dense data card (the week table) grows to beside its aside; from 64rem its Timeline column takes the spare width | implemented |
| `--width-input-compact` | 3.25rem | A time or duration field in a dense table row; "08:00" fits at WCAG 1.4.12 text spacing                                     | implemented |
| `--width-input-short`   | 6.5rem  | A short form field: a duration, a year                                                                                      | implemented |
| `--width-input-date`    | 10rem   | A date field or a short select                                                                                              | implemented |
| `--pane-list-min`       | 280px   | List pane minimum                                                                                                           | proposed    |
| `--pane-list-default`   | 380px   | List pane default                                                                                                           | proposed    |
| `--pane-detail-min`     | 480px   | Detail pane minimum, below which panes stack                                                                                | proposed    |

**Sidebar variant — implemented.** `globals.css` defines one custom variant
for the shell, driven by `data-sidebar` on `<html>` (set before first paint):

**Utilities — implemented.** `grid-cols-main-aside` (and `-wide`) lay a
page's main column beside its aside; apply them in a container query
(`@4xl:grid-cols-main-aside`). `row-marker` draws the current row's accent bar.

`sidebar-rail:` applies when the sidebar is collapsed, **or** at any width
below 48rem (Tailwind's `md`; a 1280px window reaches it at 200% zoom), where
the sidebar is always the rail. Use it only inside the shell, for the rail's
width and its hidden labels. The rail tooltips open only in the rail state,
checked in JavaScript when they would open (`isSidebarRail()` in `sidebar.tsx`
mirrors the variant), so an expanded link never carries a description.

### Z-index — implemented

Six levels, defined once. Never write a numeric `z-` utility at a call site; use
`z-(--z-header)`.

| Token         | Value | Layer                                                   | Status      |
| ------------- | ----- | ------------------------------------------------------- | ----------- |
| `--z-base`    | 0     | Page content                                            | implemented |
| `--z-sticky`  | 10    | Sticky table headers, pane handles                      | implemented |
| `--z-header`  | 20    | App header and sidebar                                  | implemented |
| `--z-popover` | 40    | Dropdowns, popovers, tooltips, context menus, skip link | implemented |
| `--z-modal`   | 50    | Dialogs, AlertDialogs, the palette, their overlays      | implemented |
| `--z-toast`   | 60    | Toaster — always above a dialog                         | implemented |

### Motion — implemented

Defined once in `globals.css`: every `transition-*` utility defaults to
`--duration-fast` with the `ease-out` curve.

| Token             | Value                           | Use                               |
| ----------------- | ------------------------------- | --------------------------------- |
| `--duration-fast` | 120ms                           | Hover, press, colour changes      |
| `--duration-base` | 180ms                           | Menus, tooltips, toasts entering  |
| `--duration-slow` | 240ms                           | Dialogs, panes, the progress bar  |
| `ease-out`        | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances (Tailwind's `ease-out`) |
| `ease-in`         | `cubic-bezier(0.4, 0, 1, 1)`    | Exits                             |
| `ease-in-out`     | `cubic-bezier(0.4, 0, 0.2, 1)`  | Movement and resizing             |

`animate-enter` (a 4px rise with a 2% scale) opens menus, tooltips and dialogs;
`animate-enter-from-end` slides a toast in. Entrances **move but never fade**,
so a colour is never sampled half-transparent (an axe run straight after a menu
opens). Motion communicates state or continuity; it is never decoration.
Layout-shifting animation on list rows is banned. `prefers-reduced-motion`
collapses everything to near-instant, globally in `globals.css`.

### Focus ring — implemented

One definition, the `focus-ring` utility in `globals.css`: a 2px `--ring`
outline with a 2px gap (`--focus-ring-width`, `--focus-ring-offset`), on
`:focus-visible` only. Every interactive primitive applies it (Button, Input,
NativeSelect, Tabs, Switch, Toast, the sidebar links, the skip link).
`focus-ring-inset` draws the same ring inside, for a scroll region whose edges
would clip it (`TableContainer scrollable`).

- The ring clears 3:1 against every surface it sits on (tested); the gap shows
  the surface behind, which is what separates it from a `primary`-filled button.
- An outline, not a box-shadow, so it survives forced colours.
- Never `outline: none` without an equivalent indicator.

### Border radius — implemented

One base `--radius: 0.5rem` (8px) derives `radius-sm` (4px), `radius-md`
(6px), `radius-lg` (8px), `radius-xl` (12px). Inputs, buttons, tags and menu
items use `md`, menus and toasts `lg`, cards and dialogs `xl`, the switch and
progress bar `full`. Table rows stay square.

### Elevation — implemented

| Level | Token       | Use                                               |
| ----- | ----------- | ------------------------------------------------- |
| 0     | none        | Table rows, flush surfaces                        |
| 1     | `shadow-xs` | Cards, outline buttons and fields (a hairline)    |
| 2     | `shadow-md` | Dropdowns, popovers, tooltips, context menus      |
| 3     | `shadow-lg` | Dialogs, toasts, side panels, the command palette |

The shadows are `--elevation-*` tokens: a cool, faint shadow in light, a deeper
black one in dark, where the lighter surface does most of the work. Never stack
heavy shadows.

### Iconography — implemented

Lucide only. `size={16}` inline (the default at 14px body), `20` standalone;
`1.5`–`2px` stroke; `currentColor`. Interactive icons need an accessible name;
decorative icons are `aria-hidden`.

### Scrollbars and selection — implemented

- Scrollbars follow the theme (`scrollbar-width: thin`, `--input` on
  transparent, on `<html>`). Never hide a scrollbar that indicates scrollable
  content.
- **Scroll containment:** tables own their horizontal scroll
  (`TableContainer`); the page scrolls only vertically.
- Text selection uses `highlight` with `foreground`, readable in both themes.
- The current row is a **surface** change (`highlight`) plus a marker bar
  (`row-marker`), not a colour-only cue.

### Themes — implemented

Light, dark and system. In the dark theme, native form controls (inputs and selects) take
`color-scheme: dark`, so date pickers and select popups match it. It is
scoped to the controls: set on the root, it restyled the whole page and
briefly mixed old and new colours when the theme flipped. The preference is stored in `localStorage` and applied as
`.dark` on `<html>`; an inline script in `index.html` sets it before first paint
so there is no flash. Components never branch on theme in JS — tokens flip.

**The header's Theme menu** (`app-shell.tsx`) offers Light, Dark and System as
radio items with a tick; its button is named "Theme: <choice>" and shows the
choice's icon.

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

| Component        | Spec                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Button**       | Variants `default \| secondary \| outline \| ghost \| destructive \| link`; sizes `sm` 28 \| `default` 32 \| `lg` 40 \| `icon` 32 \| `icon-sm` 28; `wrap` lets a long label wrap (height grows from the size's) so it reflows at 320 CSS px. **`isPending`**: a spinner joins the label (which stays, so the name and width hold), the button is disabled and `aria-busy`. One primary per view; icon-only needs `aria-label`.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Input**        | `size="sm" \| "default" \| "lg"` (28/32/40px, matching `Button`), `card` fill, `border-input`, `aria-invalid` → `destructive-text` border, a `muted` fill when read-only, the focus ring. Its look is `fieldVariants`, shared with `NativeSelect`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Label**        | Radix label, 14px/500, `peer-disabled` styling. Always bound to a control.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Card**         | `card` surface, a border, `radius-xl`, `shadow-xs`; slots pad 16px. `CardHeader` (a title over its description), `CardTitle` (`text-h3`, an `<h2>`, or `as="h3"`), `CardDescription` (`text-small`, muted), `CardContent`, `CardFooter` (a rule above). Never nest a card in a card.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Alert**        | `role="alert"` for `destructive` (announced at once), `role="status"` for the others (announced politely); a `role` prop overrides. Variants `default \| destructive \| info` (a soft fill with its `-text` colour and a leading icon), with `AlertTitle`/`AlertDescription`. Used for view- and form-level errors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Tooltip**      | `@radix-ui/react-tooltip`: `TooltipProvider` (once, in `AppShell`, 400ms delay), `Tooltip`, `TooltipTrigger`, `TooltipContent` (`popover` surface, border, `shadow-md`, 12px, `--z-popover`, portalled). Names icon-only controls; opens on hover **and** focus; Esc closes; never the only place information lives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Form**         | React Hook Form + Zod (ADR-0007): `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormDescription`/`FormMessage`, wiring ids, `aria-describedby` and `aria-invalid`. **Missing:** the error summary and first-invalid-field focus that FRONTEND_ARCHITECTURE and ADR-0007 describe (BACKLOG.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Tabs**         | `@radix-ui/react-tabs`: `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`. Controlled from the URL (`?tab=`). The list is one tab stop; ←/→ move and activate, Home/End; the panel is focusable. Triggers are 40px; the selected tab has a 2px `primary` underline and a 500 weight, not colour alone. Only the open panel renders. The list wraps at the reflow floor.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Switch**       | `@radix-ui/react-switch`: `role="switch"` with `aria-checked`; 36×20 track, `primary` when on, a `muted-foreground` outline and thumb when off (the thumb's position also shows the state). Space/Enter toggle. A switch that saves by itself shows a quiet "Saved" in a `role="status"` beside it; in an explicit-save form it is a field.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Toast**        | `@radix-ui/react-toast`: one `Toaster` (in `AppShell`, after `<main>`), bottom-right, `--z-toast`, `--width-toast`, `popover` surface, `radius-lg`, `shadow-lg`, sliding in from the end; icons in the status `-text` colours; raised with `toast({ title, description?, variant?, action? })`. Variants `success \| error \| info`, each with an icon. Success and info 4s, **undo (a toast with an action) 8s**, errors persist until dismissed. Announced politely; never takes focus; Tab reaches the action and the dismiss button; timers pause on focus and hover; Esc dismisses. Radix's F8 hotkey is off.                                                                                                                                                                                                                                                                           |
| **Skeleton**     | A `muted` block with a pulse (none under reduced motion), `aria-hidden`; the loading region carries `aria-busy` and a text alternative. Sized to the final layout; shown only after 300ms (`useDelayedFlag`), on first load, never on a refetch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **NativeSelect** | A native `<select>` styled like `Input`, with a chevron. For short fixed option lists; the browser supplies the popup, typeahead and screen-reader support.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **DropdownMenu** | `@radix-ui/react-dropdown-menu`: `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`/`DropdownMenuSeparator`, plus `DropdownMenuLabel` and `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` (a tick marks the choice, with `aria-checked`) for a set of choices such as the theme. Items are 32px. The actions on a control, such as a row's "⋯" icon button (named "Actions for …"). `popover` surface, border, `shadow-md`, `--z-popover`, portalled, aligned to the trigger's end; items are 14px with an `accent` highlight, not colour alone (the highlight is a surface). Non-modal, as a popover is: nothing behind it is hidden from assistive technology. Enter/Space/↓ open on the first item, ↑↓ Home End move, typeahead, Enter runs, Esc or Tab closes (Radix keeps Tab in the menu, so the wrapper turns it into Esc), focus returns to the trigger. |
| **ContextMenu**  | `@radix-ui/react-context-menu`, with the same look as `DropdownMenu`: the same actions on right-click of a row, always mirrored by a visible "⋯" menu. Shift+F10 or the Menu key opens it on the focused element; a text field inside keeps the browser's own menu (it stops the event).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **AlertDialog**  | `@radix-ui/react-alert-dialog`: `AlertDialog`/`AlertDialogContent`/`AlertDialogTitle`/`AlertDialogDescription`/`AlertDialogFooter`/`AlertDialogCancel`/`AlertDialogAction`. **Only** for irreversible actions (discarding unsaved changes); the action button is `destructive` and names the action. A `foreground/40` overlay and a `popover` panel at `--z-modal`, `--width-dialog`, `shadow-lg`, filling the width at the reflow floor. Focus starts on Cancel and is trapped; Esc cancels; clicking outside does nothing; focus returns to what had it when the dialog opened (a trigger, or the control whose action a blocker stopped).                                                                                                                                                                                                                                                |
| **Badge**        | A short, non-interactive tag: `text-meta`, 500 weight, `radius-md`, sized to its text. Variants `default` (neutral), `outline`, `primary` (filled accent: "Today"), and soft status chips `warning` (with a ⚠), `info` (notes, "In progress"), `success`, `destructive`. Its meaning is always in its text, never colour alone; an icon is `aria-hidden`. It wraps rather than widening a table cell. Not focusable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Table**        | `components/ui/table.tsx`: `TableContainer` (owns horizontal scroll; `scrollable` makes it a named, focusable region), `Table`, `TableHeader` (a quiet `muted` band, 13px muted headers), `TableBody`, `TableFooter` (totals), `TableRow` (`tone` `zebra \| stripe \| highlight`, `hover`), `TableHead` (`scope="col"`), `TableRowHeader` (`scope="row"`), `TableCell`; `numeric` right-aligns in tabular numerals. Rows are at least `--row-height`. The shared look until `DataTable` is built.                                                                                                                                                                                                                                                                                                                                                                                            |
| **ProgressBar**  | A slim, **decorative** (`aria-hidden`) bar of `value` against `max`: accent until the whole is reached, then `success`. The figure beside it carries the meaning. Its fill width is its one inline style, a data value.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **StatTile**     | `components/ui/stat-tile.tsx`: one headline figure as a card — a `<dt>` label (with an optional decorative icon in an accent tile), then a `<dd>` holding the figure in `text-figure`, an optional `ProgressBar`, and a muted detail line read with the figure ("Credited, 39:00 of 37:30 target"). Place tiles in a `<dl>`; `value={undefined}` shows a skeleton, so mark the `<dl>` `aria-busy` while loading.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **EmptyState**   | "Nothing here yet": a muted icon tile, the situation in a sentence (`text-lead`), what to do (muted), and at most one action. It replaces the content it stands for; not a live region.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |     |

### Planned

Build these when the first feature needs them, to this spec, wrapping any
third-party headless library as an owned primitive in `components/ui/`.

| Component                          | Spec                                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Kbd**                            | Renders a shortcut (`⌘K` / `Ctrl K`) in `font-mono` at `text-meta` with a bordered chip. Used in the palette trigger and menu items.                                                                                                                              |
| **Dialog**                         | Radix modal: focus trap, Esc, focus return, labelled by title, scroll lock, `--z-modal`, `--width-dialog`. For a short task the owner must finish or cancel; build it on the same parts as `AlertDialog`.                                                         |
| **Command palette**                | `cmdk` wrapped as a primitive. Ctrl/Cmd+K, filter-as-you-type, `aria-activedescendant`, grouped results, Esc returns focus. See UX_STANDARDS.md.                                                                                                                  |
| **DataTable**                      | TanStack Table wrapped as a primitive: column min-width + grow, sticky header, sort with `aria-sort`, filters, row selection with roving tabindex, virtualisation above ~200 rows, tabular numerals on numeric columns, skeleton/empty/filtered-empty/error rows. |
| **Resizable panels**               | `react-resizable-panels` wrapped as a primitive: drag **and** arrow-key resize on the handle (2.5.7), min sizes from the layout tokens, sizes persisted per route.                                                                                                |
| **Inspector / side panel**         | Non-modal right panel over the detail area; Esc closes; the list behind stays operable. Not a modal and never an overlay.                                                                                                                                         |
| **Breadcrumb, Pagination, Search** | As needed, to the same bar: token-driven, keyboard-complete, states covered, no colour-only meaning.                                                                                                                                                              |

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
