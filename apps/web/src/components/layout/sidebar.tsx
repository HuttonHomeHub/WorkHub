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
        'bg-sidebar text-sidebar-foreground border-sidebar-border sidebar-scope sidebar-rail:w-(--sidebar-rail) w-(--sidebar-width) shrink-0 border-r',
        className,
      )}
      {...props}
    >
      <div className="sticky top-0 grid gap-3 p-2">
        <BrandMark />
        <ul className="flex flex-col gap-0.5">
          {tools.map((tool) => (
            <li key={tool.id}>
              <SidebarLink tool={tool} />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/**
 * The app's name beside its mark, a filled accent tile, at the top of the
 * sidebar; as the rail, the tile alone (the name stays for screen readers).
 * Not a link, so it adds no tab stop.
 */
function BrandMark() {
  return (
    <span className="sidebar-rail:justify-center sidebar-rail:px-0 flex h-(--header-height) items-center gap-2.5 px-2">
      <span
        aria-hidden
        className="bg-sidebar-primary text-sidebar-primary-foreground text-small flex size-7 shrink-0 items-center justify-center rounded-lg font-bold shadow-sm"
      >
        W
      </span>
      <span className="text-sidebar-accent-foreground text-lead sidebar-rail:sr-only font-semibold tracking-tight">
        WorkHub
      </span>
    </span>
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
            'focus-ring text-body relative flex h-(--control-lg) items-center gap-3 rounded-lg px-3 transition-colors',
            'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            // Current: a surface, a heavier weight, an accent icon and a marker bar — not colour alone.
            'data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground data-[status=active]:font-medium',
            'data-[status=active]:[&>svg]:text-sidebar-primary',
            'data-[status=active]:before:bg-sidebar-primary data-[status=active]:before:absolute data-[status=active]:before:inset-y-1.5 data-[status=active]:before:-left-2 data-[status=active]:before:w-1 data-[status=active]:before:rounded-r-full',
            'sidebar-rail:justify-center sidebar-rail:px-0 sidebar-rail:gap-0',
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
