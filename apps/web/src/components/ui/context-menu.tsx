import * as ContextMenuPrimitive from '@radix-ui/react-context-menu';
import * as React from 'react';

import {
  closeOnTab,
  menuContentClasses,
  menuItemClasses,
  menuSeparatorClasses,
} from './dropdown-menu';

import { cn } from '@/lib/utils';

/**
 * ContextMenu — the same actions as a visible "⋯" `DropdownMenu`, on
 * right-click (docs/DESIGN_SYSTEM.md → DropdownMenu / ContextMenu). It is an
 * accelerator, never the only way to an action (docs/UX_STANDARDS.md → Context
 * menus and hover): always mirror it with a `DropdownMenu`.
 *
 * Keyboard contract: Shift+F10 or the Menu key on a focused element inside
 * the trigger opens the menu (the browser raises `contextmenu` there); then as
 * `DropdownMenu`: ↑/↓ move, Home/End, typeahead, Enter or Space runs an item,
 * Esc or Tab closes. Focus returns to the element that was focused. A text field
 * inside the trigger can keep the browser's own menu (copy and paste) by
 * stopping the event's propagation in its `onContextMenu`. Non-modal by
 * default, like `DropdownMenu`.
 */
function ContextMenu({
  modal = false,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Root>) {
  return <ContextMenuPrimitive.Root modal={modal} {...props} />;
}

/** The area that opens the menu on right-click; `asChild` keeps its element (a `<tr>`). */
function ContextMenuTrigger(props: React.ComponentProps<typeof ContextMenuPrimitive.Trigger>) {
  return <ContextMenuPrimitive.Trigger {...props} />;
}

/** The menu's panel, portalled to `<body>` at the pointer. */
function ContextMenuContent({
  className,
  onKeyDown,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content
        onKeyDown={(event) => {
          onKeyDown?.(event);
          closeOnTab(event);
        }}
        className={cn(menuContentClasses, className)}
        {...props}
      />
    </ContextMenuPrimitive.Portal>
  );
}

/** One action; `onSelect` runs it. */
function ContextMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Item>) {
  return <ContextMenuPrimitive.Item className={cn(menuItemClasses, className)} {...props} />;
}

/** A rule between groups of items. */
function ContextMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
  return (
    <ContextMenuPrimitive.Separator className={cn(menuSeparatorClasses, className)} {...props} />
  );
}

export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
};
