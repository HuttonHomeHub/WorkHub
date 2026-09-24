import { Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Toaster } from '@/components/ui/toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme, type Theme } from '@/hooks/use-theme';
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

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const satisfies readonly { value: Theme; label: string; icon: LucideIcon }[];

function isTheme(value: string): value is Theme {
  return THEMES.some((option) => option.value === value);
}

/**
 * The three-way theme control (DESIGN_SYSTEM.md → Themes): a menu button named
 * "Theme" with the choice in its description, opening Light, Dark and System
 * as radio items. Its icon shows the choice. Keyboard: as DropdownMenu.
 */
function ThemeMenu() {
  const { theme, setTheme } = useTheme();
  const current = THEMES.find((option) => option.value === theme) ?? THEMES[2];
  const Icon = current.icon;
  // The tooltip names the button; it never shows over the open menu, and the
  // focus the menu hands back as it closes does not reopen it (it would stay
  // up after the pointer had gone). Leaving or blurring the button re-arms it.
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [tooltipOpen, setTooltipOpen] = React.useState(false);
  const menuJustClosed = React.useRef(false);
  const rearm = () => {
    menuJustClosed.current = false;
  };
  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (open) setTooltipOpen(false);
        else menuJustClosed.current = true;
      }}
    >
      <Tooltip
        open={tooltipOpen && !menuOpen}
        onOpenChange={(open) => {
          if (open && menuJustClosed.current) {
            menuJustClosed.current = false;
            return;
          }
          setTooltipOpen(open);
        }}
      >
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Theme: ${current.label}`}
              onPointerLeave={rearm}
              onBlur={rearm}
            >
              <Icon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Theme</TooltipContent>
      </Tooltip>
      <DropdownMenuContent>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => {
            if (isTheme(value)) setTheme(value);
          }}
        >
          {THEMES.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon aria-hidden />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
      className="focus-ring bg-popover text-foreground text-body sr-only z-(--z-popover) rounded-md border px-3 py-2 font-medium shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Skip to main content
    </a>
  );
}

/**
 * The authenticated app shell (docs/UX_STANDARDS.md → App shell): a skip link,
 * a 48px sticky header (`<header>`), the full-height tools sidebar (`<nav>`,
 * with the brand at its top), the page
 * (`<main>`) and the one toaster. Content fills the window up to `--width-page`; pages cap prose
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
      {/* A grid keeps the DOM order skip link, header, sidebar, page (so Tab
          reaches the header's controls first) while the sidebar runs the full
          height on the left. */}
      <div className="bg-background text-foreground grid min-h-svh grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_1fr]">
        <SkipLink />
        <header className="bg-background/85 sticky top-0 z-(--z-header) col-start-2 row-start-1 flex min-h-(--header-height) flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2 backdrop-blur-md max-md:static">
          <SidebarToggle collapsed={collapsed} onToggle={toggle} />
          <div className="flex flex-wrap items-center gap-2">
            <ThemeMenu />
            {actions}
          </div>
        </header>
        <Sidebar
          id={SIDEBAR_ID}
          tools={tools}
          aria-label="Tools"
          className="col-start-1 row-span-2 row-start-1"
        />
        <main
          id={MAIN_ID}
          tabIndex={-1}
          className="col-start-2 row-start-2 min-w-0 px-6 pt-6 pb-12 outline-none max-md:px-4"
        >
          {/* Long words wrap rather than widen the page at the reflow floor. */}
          <div className="max-w-(--width-page) break-words">{children}</div>
        </main>
        {/* After <main> in the DOM, so Tab from the page reaches a toast's action. */}
        <Toaster label="Notifications" dismissLabel="Dismiss notification" />
      </div>
    </TooltipProvider>
  );
}
