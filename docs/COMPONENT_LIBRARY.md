# Component Library Guidelines

> How reusable components are built, named and tested in `apps/web`. What they
> look like is in [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md); where they live is in
> [`FRONTEND_ARCHITECTURE.md`](FRONTEND_ARCHITECTURE.md); accessibility rules are
> in [`ACCESSIBILITY.md`](ACCESSIBILITY.md).

## The qualities

Every reusable component is:

- **Composable** — built from smaller primitives, exposing slots and children
  rather than a dozen boolean props.
- **Keyboard-complete** — it documents and implements a keyboard contract (below).
- **Dense-ready** — it fits the 32px control scale and offers size variants where
  a control appears in both forms and tables.
- **Testable** — behaviour verifiable with Testing Library queries by role and
  label.
- **Reusable** — no business logic, no data fetching, no hard-coded copy.

## Component tiers

| Tier                  | Location                                    | Contains                                   | May depend on                             |
| --------------------- | ------------------------------------------- | ------------------------------------------ | ----------------------------------------- |
| **Primitive**         | `components/ui/`                            | Button, Input, Form, and wrapped libraries | tokens, Radix, headless libraries, `cn()` |
| **Composite, layout** | `components/layout/`, feature `components/` | AppShell, a feature's list or form         | primitives                                |
| **Route**             | `routes/`                                   | Screen composition and data                | composites, primitives, feature hooks     |

Dependencies point down the tiers only. Primitives never import feature code.

### Third-party headless libraries are wrapped

When a primitive needs a library — **TanStack Table** (`DataTable`), **cmdk**
(command palette), **react-resizable-panels** (resizable panes), **TanStack
Virtual** (long lists), Radix packages — it is wrapped once in `components/ui/`
as an owned primitive with our tokens, density, keyboard contract and API. App
code imports the wrapper, never the library, so the library can be upgraded or
replaced in one file. Adding one is a new runtime dependency, which raises the
change class (CLAUDE.md §3).

## Naming — as the code does it

- **Files are kebab-case**: `button.tsx`, `app-shell.tsx`, `sign-in-form.tsx`,
  `use-theme.tsx`. The component inside is PascalCase (`Button`, `AppShell`).
- **Flat named exports, not dot-compound components.** `card.tsx` exports
  `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`,
  `CardFooter`; `form.tsx` exports `Form`, `FormField`, `FormItem`, … — never
  `Card.Header`.
- **Hooks:** `useCamelCase` in a kebab-case file (`use-theme.tsx` exports
  `useTheme`), in `hooks/` or a feature's `hooks/`.
- **Props:** `‹Name›Props` (`ButtonProps`).
- **Variants:** semantic values (`variant="destructive"`, `size="sm"`), never
  style-leaking names.
- **Booleans** read positively (`disabled`, `isPending`); events are `onX`,
  controlled changes `onXChange`.
- **Tests** are co-located: `sign-in-form.test.tsx` next to `sign-in-form.tsx`.

## Component API rules

- **Props are minimal and typed**, no `any`. Extend the element's props
  (`React.ComponentPropsWithoutRef<'button'>`) so `className` and `aria-*` pass
  through.
- **Refs are props (React 19).** Do not use `forwardRef`; a `ref` passed to a
  function component reaches it as a prop and is spread onto the element.
- **`className` merges** through `cn()`; callers extend, never override. No
  `style` prop for themeable values.
- **Variants via CVA**, declared once; the variant type is derived from it
  (`button.tsx`, `alert.tsx`).
- **Size variants are required** on any control that appears in both forms and
  dense tables: `sm` (28px), `default` (32px), `lg` (40px) per
  [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#density-and-control-sizing--proposed). Today `Button`
  has them (at the old 32/36/40px scale) and `Input` does not.
- **`asChild`** (Radix `Slot`) for rendering a primitive's styling on another
  element, as `Button asChild` wraps a router `Link`.
- **Controlled and uncontrolled** where it matters (`value`/`defaultValue`,
  `onValueChange`), following Radix.
- **No fetching or business logic**; data and callbacks come in as props.
- **No hard-coded user-facing copy** in primitives or composites.

## Keyboard contract

Every interactive component documents, in its TSDoc, the keys it handles and
where focus goes — and its tests exercise them. Base contracts:

| Component          | Keys                                                                                     | Focus                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Button             | Enter, Space activate                                                                    | Stays on the button                                       |
| Input / Form field | Native editing; Enter submits a single-line form; Ctrl/Cmd+Enter submits from a textarea | First invalid field focused on submit                     |
| DropdownMenu       | Enter/Space/↓ open; ↑↓ move; typeahead; Enter selects; Esc closes                        | Returns to the trigger                                    |
| ContextMenu        | Shift+F10 / Menu key opens on the focused row; then as DropdownMenu                      | Returns to the row                                        |
| Dialog             | Esc closes; Tab cycles inside                                                            | Trapped; initial focus on first field; returns to trigger |
| AlertDialog        | Esc cancels; Enter on the focused button                                                 | Initial focus on **Cancel**; returns to trigger           |
| Popover / Tooltip  | Esc closes; Tab leaves (popover); tooltip opens on focus                                 | Popover returns to trigger                                |
| Toast              | Tab reaches the action; Esc dismisses when focused                                       | Never steals focus                                        |
| Command palette    | Ctrl/Cmd+K opens; ↑↓ move (`aria-activedescendant`); Enter runs; Esc closes              | Input focused; returns to previous element                |
| DataTable / list   | ↑↓ Home End PageUp PageDown move; Enter opens; Space selects; Shift+↑↓ extends           | One tab stop (roving tabindex); next row after delete     |
| Resizable handle   | ←→ (or ↑↓) resize by a step; Home/End to min/max                                         | Stays on the handle                                       |
| Tabs               | ←→ move and activate; Home/End                                                           | Roving tabindex                                           |

No component binds a custom shortcut or a single-character key
([UX_STANDARDS.md](UX_STANDARDS.md#keyboard-model)).

## Required states

A component with interaction or data implements, and tests, each state that
applies: default, hover, active, focus-visible, disabled, pending/busy, error,
empty, selected. A missing state is an incomplete component.

## Lifecycle

1. **Reuse first** — extend an existing primitive with a variant before adding
   one.
2. **Build** against tokens and the keyboard contract, with every state in light
   and dark.
3. **Test** behaviour, keyboard and accessible names.
4. **Document** with TSDoc (purpose, keyboard contract, non-obvious props) and
   add its spec to [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md#component-specs).
5. **Review** with ui-reviewer and accessibility-reviewer (`/review`).
6. **Replace, don't deprecate.** WorkHub is one private app with no external
   consumers: when a component is superseded, migrate every call site and delete
   the old one **in the same PR**. Never leave two ways to do the same thing.

## Testing

Strategy, tooling and test layers are in [TESTING.md](TESTING.md). For
components specifically: query by role and label, assert behaviour and
accessible names rather than class names, exercise the keyboard contract, and
smoke-render each variant and size.

## Anti-patterns (rejected in review)

- One-off styling, magic values, or a numeric `z-` / arbitrary size at a call site.
- Importing a wrapped library (Radix, cmdk, TanStack Table) directly in app code.
- Boolean-prop explosions instead of composition.
- Fetching, business logic or hard-coded copy inside a reusable component.
- `forwardRef` in new code; PascalCase file names; dot-compound exports.
- A second component that does what an existing one does.
- A custom keyboard shortcut, or an interaction reachable only by hover or
  right-click.
