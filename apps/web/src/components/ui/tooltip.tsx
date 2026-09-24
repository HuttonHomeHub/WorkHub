import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Tooltip — names an icon-only control (docs/DESIGN_SYSTEM.md → Tooltip). It is
 * a label, never the only place information lives.
 *
 * Keyboard contract: opens when the trigger receives keyboard focus and closes
 * on Esc or blur; opens on hover after the provider's delay, and stays open
 * while the pointer moves onto it (WCAG 1.4.13). Focus never moves into it.
 *
 * A `TooltipProvider` must wrap every tooltip; `AppShell` provides one for the
 * signed-in app, so moving between triggers skips the delay once one has opened.
 */
function TooltipProvider({
  delayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

/** One tooltip: wrap a `TooltipTrigger` and a `TooltipContent`. */
function Tooltip(props: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props} />;
}

/** The control the tooltip names. Use `asChild` to keep the control's own element. */
function TooltipTrigger(props: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} />;
}

/** The tooltip bubble, portalled to `<body>` above the page (`--z-popover`). */
function TooltipContent({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground animate-enter text-meta z-(--z-popover) rounded-md border px-2 py-1 font-medium shadow-md',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
