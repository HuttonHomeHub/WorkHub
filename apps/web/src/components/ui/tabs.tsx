import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Tabs — switches between panels of one page (docs/DESIGN_SYSTEM.md → Tabs).
 * The open tab belongs in the URL (docs/UX_STANDARDS.md → URL state), so pass
 * `value` and `onValueChange` from the route's search params.
 *
 * Keyboard contract: the tab list is one tab stop (roving tabindex); ←/→ move
 * between tabs and activate them, Home/End jump to the first and last. Tab
 * leaves the list for the open panel, which is itself focusable so its content
 * can be reached even when it has no control first.
 */
function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}

/** The row of tabs. Name it with `aria-label` when the page has no visible heading for it. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex flex-wrap items-end gap-1 border-b', className)}
      {...props}
    />
  );
}

/**
 * One tab. The selected tab is marked by a 2px underline and a 500 weight, not
 * by colour alone.
 */
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background data-[state=active]:border-primary data-[state=active]:text-foreground -mb-px inline-flex h-9 items-center justify-center border-b-2 border-transparent px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-medium',
        className,
      )}
      {...props}
    />
  );
}

/** A tab's panel. Only the open panel is rendered, so a tab loads its data when opened. */
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn(
        'focus-visible:ring-ring focus-visible:ring-offset-background pt-6 outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
