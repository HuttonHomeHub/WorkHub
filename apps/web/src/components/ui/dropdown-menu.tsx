import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * DropdownMenu — a list of actions on a control, such as a row's "⋯" button
 * (docs/DESIGN_SYSTEM.md → DropdownMenu / ContextMenu). Every right-click
 * `ContextMenu` is mirrored by one of these (docs/UX_STANDARDS.md → Context
 * menus and hover).
 *
 * Keyboard contract: Enter, Space or ↓ on the trigger opens the menu with
 * focus on the first item (↑ opens on the last); ↑/↓ move, Home/End jump,
 * typing a letter moves to the next item starting with it; Enter or Space runs
 * the item and closes the menu; Esc (or Tab) closes it. Focus returns to the
 * trigger. The menu is portalled above the page (`--z-popover`) and is
 * **non-modal** by default, as a popover is (docs/UX_STANDARDS.md →
 * Overlays): the page stays in the accessibility tree and nothing is hidden
 * with `aria-hidden` behind it; a click outside closes it.
 */
function DropdownMenu({
  modal = false,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root modal={modal} {...props} />;
}

/** The control that opens the menu. Use `asChild` with a `Button`. */
function DropdownMenuTrigger(props: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return <DropdownMenuPrimitive.Trigger {...props} />;
}

/**
 * The shared look of a menu's panel and items, used by `ContextMenu` too, so
 * both menus of a row look and behave the same.
 */
const menuContentClasses =
  'bg-popover text-popover-foreground z-(--z-popover) min-w-44 overflow-hidden rounded-md border p-1 text-sm shadow-md';
const menuItemClasses =
  'relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0';
const menuSeparatorClasses = 'bg-border -mx-1 my-1 h-px';

/**
 * Radix keeps Tab inside an open menu; the app's rule is that Tab closes a
 * menu (docs/UX_STANDARDS.md → Focus scopes). Tab is turned into the Escape
 * Radix already handles, so the menu closes and focus returns to its trigger,
 * from where the next Tab moves on.
 */
function closeOnTab(event: React.KeyboardEvent<HTMLDivElement>): void {
  if (event.key !== 'Tab' || event.defaultPrevented) return;
  event.currentTarget.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  );
}

/** The menu's panel, portalled to `<body>`, aligned to the trigger's end. */
function DropdownMenuContent({
  className,
  sideOffset = 4,
  align = 'end',
  onKeyDown,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        onKeyDown={(event) => {
          onKeyDown?.(event);
          closeOnTab(event);
        }}
        sideOffset={sideOffset}
        align={align}
        className={cn(menuContentClasses, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

/** One action. Label it with a verb ("Clear day"); `onSelect` runs it. */
function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item>) {
  return <DropdownMenuPrimitive.Item className={cn(menuItemClasses, className)} {...props} />;
}

/** A rule between groups of items. */
function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator className={cn(menuSeparatorClasses, className)} {...props} />
  );
}

export {
  closeOnTab,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  menuContentClasses,
  menuItemClasses,
  menuSeparatorClasses,
};
