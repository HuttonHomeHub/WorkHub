import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from 'lucide-react';
import * as React from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/use-theme';
import { readPreference, writePreference } from '@/lib/preferences';
import type { ToolManifest } from '@/lib/tool-manifest';

interface AppShellProps {
  /** The tool manifests for the sidebar, in order (`app/tools.ts`). */
  tools: readonly ToolManifest[];
  /** Right-hand header content (user menu, sign-out, …). */
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const MAIN_ID = 'main';
const SIDEBAR_ID = 'sidebar';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}

/**
 * The persisted sidebar state. `index.html` applies it to `<html>` before first
 * paint; this keeps `data-sidebar` in step with it afterwards.
 */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = React.useState(() => readPreference('sidebar').collapsed);

  React.useLayoutEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? 'collapsed' : 'expanded';
  }, [collapsed]);

  const toggle = React.useCallback(() => {
    const next = !collapsed;
    writePreference('sidebar', { collapsed: next });
    setCollapsed(next);
  }, [collapsed]);

  return { collapsed, toggle };
}

/**
 * A disclosure-style toggle: one stable name ("Sidebar") with `aria-expanded`
 * for the state and `aria-controls` for the `<nav>`. The tooltip names the
 * action it will take.
 */
function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Below 48rem the sidebar is always the rail, so the toggle would do nothing. */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sidebar"
          aria-expanded={!collapsed}
          aria-controls={SIDEBAR_ID}
          onClick={onToggle}
          className="max-md:hidden"
        >
          {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Moves keyboard focus past the header and sidebar to the page (WCAG 2.4.1).
 * Visually hidden until focused; it is the first stop in the tab order.
 */
function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={(event) => {
        // Focus <main> without adding a #main history entry for the router.
        event.preventDefault();
        document.getElementById(MAIN_ID)?.focus();
      }}
      className="bg-background text-foreground focus-visible:ring-ring focus-visible:ring-offset-background sr-only z-(--z-popover) rounded-md border px-3 py-2 text-sm font-medium shadow-md outline-none focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}

/**
 * The authenticated app shell (docs/UX_STANDARDS.md → App shell): a skip link,
 * a 48px sticky header (`<header>`), the tools sidebar (`<nav>`) and the page
 * (`<main>`). Content fills the window up to `--width-page`; pages cap prose
 * and forms themselves.
 *
 * Below 48rem (a 1280px window at 200% zoom and beyond, down to the 320 CSS px
 * reflow floor) the header wraps and scrolls away with the page instead of
 * sticking, and the sidebar is the rail.
 */
export function AppShell({ tools, actions, children }: AppShellProps) {
  const { collapsed, toggle } = useSidebarCollapsed();
  return (
    // The shell is the only place with tooltips today; providing them here keeps
    // Radix out of the sign-in page's JavaScript.
    <TooltipProvider>
      <div className="bg-background text-foreground flex min-h-svh flex-col">
        <SkipLink />
        <header className="bg-background/95 sticky top-0 z-(--z-header) flex min-h-(--header-height) flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-3 py-1.5 backdrop-blur max-md:static">
          <div className="flex items-center gap-2">
            <SidebarToggle collapsed={collapsed} onToggle={toggle} />
            <span className="font-semibold">WorkHub</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            {actions}
          </div>
        </header>
        <div className="flex flex-1">
          <Sidebar id={SIDEBAR_ID} tools={tools} aria-label="Tools" />
          <main id={MAIN_ID} tabIndex={-1} className="min-w-0 flex-1 p-6 outline-none">
            {/* Long words wrap rather than widen the page at the reflow floor. */}
            <div className="max-w-(--width-page) break-words">{children}</div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
