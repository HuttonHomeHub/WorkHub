import { Link } from '@tanstack/react-router';
import * as React from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ToolManifest } from '@/lib/tool-manifest';
import { cn } from '@/lib/utils';

/**
 * Whether the sidebar is showing the rail right now: collapsed, or narrower
 * than 48rem. Mirrors the `sidebar-rail` variant in globals.css; keep the two
 * in step. Read at event time only, never to lay anything out.
 */
function isSidebarRail(): boolean {
  if (document.documentElement.dataset.sidebar === 'collapsed') return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(width < 48rem)').matches;
}

interface SidebarProps extends React.ComponentPropsWithoutRef<'nav'> {
  /** The tool manifests, in sidebar order (`app/tools.ts`). */
  tools: readonly ToolManifest[];
}

/**
 * The app's navigation sidebar (docs/UX_STANDARDS.md → App shell): one link
 * per tool, built from the manifests (ADR-0020). Pass an `aria-label` to name
 * the `<nav>` landmark.
 *
 * Expanded (240px) it shows each tool's icon and label. As the rail (56px),
 * when collapsed or below 48rem, it shows icons only: the label stays in the
 * accessibility tree as the link's name, and a tooltip shows it on hover and
 * focus. The expanded/rail switch is CSS (the `sidebar-rail` variant in
 * globals.css), driven by `data-sidebar` on `<html>`. Expanded, the label is
 * visible, so the tooltip never opens (and adds no `aria-describedby`).
 *
 * Keyboard contract: each tool is a link in the tab order; Enter follows it.
 * The link for the current tool, and for every route under it, carries
 * `aria-current="page"`.
 */
export function Sidebar({ tools, className, ...props }: SidebarProps) {
  return (
    <nav
      className={cn(
        'bg-sidebar text-sidebar-foreground border-sidebar-border sidebar-rail:w-(--sidebar-rail) w-(--sidebar-width) shrink-0 border-r',
        className,
      )}
      {...props}
    >
      <ul className="sticky top-(--header-height) flex flex-col gap-1 p-2 max-md:top-0">
        {tools.map((tool) => (
          <li key={tool.id}>
            <SidebarLink tool={tool} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SidebarLink({ tool }: { tool: ToolManifest }) {
  const Icon = tool.icon;
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  return (
    <Tooltip open={tooltipOpen} onOpenChange={(open) => setTooltipOpen(open && isSidebarRail())}>
      <TooltipTrigger asChild>
        <Link
          to={tool.path}
          // The router's default matching marks a tool current on its sub-pages
          // whatever their search params, and matches `/` only exactly
          // (covered by app-shell.test.tsx).
          className={cn(
            'relative flex h-8 items-center gap-3 rounded-md px-3 text-sm outline-none',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2',
            // Current: a surface, a heavier weight and a marker bar — not colour alone.
            'data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:font-medium',
            'data-[status=active]:before:bg-sidebar-primary data-[status=active]:before:absolute data-[status=active]:before:inset-y-1.5 data-[status=active]:before:left-0 data-[status=active]:before:w-0.5 data-[status=active]:before:rounded-full',
          )}
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          <span className="sidebar-rail:sr-only truncate">{tool.label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">{tool.label}</TooltipContent>
    </Tooltip>
  );
}
