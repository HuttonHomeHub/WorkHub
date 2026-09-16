import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Clock, House } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/layout/app-shell';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/hooks/use-theme';
import type { ToolManifest } from '@/lib/tool-manifest';

// A second tool with sub-pages, so `aria-current` can be checked across routes.
// Its routes exist only in this test's router, hence the cast.
const TOOLS: readonly ToolManifest[] = [
  { id: 'home', label: 'Home', icon: House, path: '/', commands: [] },
  {
    id: 'hours',
    label: 'Hours',
    icon: Clock,
    path: '/hours' as ToolManifest['path'],
    commands: [],
  },
];

async function renderShell(initialPath = '/') {
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider>
        <TooltipProvider delayDuration={0}>
          <AppShell tools={TOOLS} actions={<button type="button">Sign out</button>}>
            <Outlet />
          </AppShell>
        </TooltipProvider>
      </ThemeProvider>
    ),
  });
  const page = (path: string, title: string) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => <h1>{title}</h1> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      page('/', 'Home page'),
      page('/hours', 'Hours page'),
      page('/hours/summary', 'Summary page'),
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  const result = render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 });
  return { ...result, router };
}

function sidebar() {
  return screen.getByRole('navigation', { name: 'Tools' });
}

beforeEach(() => {
  // The router restores scroll on navigation; jsdom does not implement it.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  // ThemeProvider reads matchMedia only in `system` mode, which jsdom lacks.
  localStorage.setItem('theme', 'light');
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.sidebar;
});

describe('AppShell', () => {
  it('renders the banner, tools navigation and main landmarks', async () => {
    await renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(sidebar()).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { name: 'Home page' }),
    );
  });

  describe('sidebar', () => {
    it('lists a link per tool with its sentence-case label, in manifest order', async () => {
      await renderShell();
      const links = within(sidebar()).getAllByRole('link');
      expect(links.map((link) => link.textContent)).toEqual(['Home', 'Hours']);
      expect(links[1]).toHaveAttribute('href', '/hours');
    });

    it('marks only Home as current on the home page', async () => {
      await renderShell('/');
      expect(within(sidebar()).getByRole('link', { name: 'Home' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(sidebar()).getByRole('link', { name: 'Hours' })).not.toHaveAttribute(
        'aria-current',
      );
    });

    it('marks a tool as current on its sub-pages and with search params, and never Home', async () => {
      const { router } = await renderShell('/hours/summary');
      const hours = within(sidebar()).getByRole('link', { name: 'Hours' });
      expect(hours).toHaveAttribute('aria-current', 'page');
      expect(within(sidebar()).getByRole('link', { name: 'Home' })).not.toHaveAttribute(
        'aria-current',
      );

      await act(() => router.navigate({ to: '/hours', search: { week: '2026-10-05' } } as never));
      await screen.findByRole('heading', { name: 'Hours page' });
      expect(hours).toHaveAttribute('aria-current', 'page');
    });

    it('is operable by keyboard: Tab reaches each tool and Enter follows it', async () => {
      const user = userEvent.setup();
      await renderShell('/');
      const hours = within(sidebar()).getByRole('link', { name: 'Hours' });

      // Skip link, sidebar toggle, theme toggle, the actions, then the tools.
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();
      expect(within(sidebar()).getByRole('link', { name: 'Home' })).toHaveFocus();
      await user.tab();
      expect(hours).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(await screen.findByRole('heading', { name: 'Hours page' })).toBeInTheDocument();
      expect(hours).toHaveAttribute('aria-current', 'page');
    });

    it('shows the label in a tooltip when a rail item receives focus', async () => {
      const user = userEvent.setup();
      localStorage.setItem(
        'workhub:sidebar',
        JSON.stringify({ version: 1, value: { collapsed: true } }),
      );
      await renderShell('/');

      const hours = within(sidebar()).getByRole('link', { name: 'Hours' });
      for (let stop = 0; stop < 6; stop += 1) await user.tab();
      expect(hours).toHaveFocus();
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Hours');
      // The label stays in the link as its accessible name in the rail.
      expect(hours).toHaveAccessibleName('Hours');
    });
  });

  describe('sidebar toggle', () => {
    it('starts expanded, collapses to the rail and persists the choice', async () => {
      const user = userEvent.setup();
      const { unmount } = await renderShell();
      expect(document.documentElement.dataset.sidebar).toBe('expanded');

      await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
      expect(document.documentElement.dataset.sidebar).toBe('collapsed');
      expect(JSON.parse(localStorage.getItem('workhub:sidebar') ?? 'null')).toEqual({
        version: 1,
        value: { collapsed: true },
      });

      // A new page load restores the rail.
      unmount();
      delete document.documentElement.dataset.sidebar;
      await renderShell();
      expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
      expect(document.documentElement.dataset.sidebar).toBe('collapsed');
    });

    it('toggles from the keyboard', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.tab();
      await user.tab();
      expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus();

      await user.keyboard('{Enter}');
      const expand = screen.getByRole('button', { name: 'Expand sidebar' });
      expect(expand).toHaveFocus();
      await user.keyboard(' ');
      expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveFocus();
      expect(document.documentElement.dataset.sidebar).toBe('expanded');
    });

    it('falls back to expanded when the stored preference is corrupt', async () => {
      localStorage.setItem('workhub:sidebar', '{not json');
      await renderShell();
      expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    });
  });

  describe('skip link', () => {
    it('is the first tab stop and moves focus to main', async () => {
      const user = userEvent.setup();
      await renderShell();
      await user.tab();
      const skip = screen.getByRole('link', { name: 'Skip to main content' });
      expect(skip).toHaveFocus();

      await user.keyboard('{Enter}');
      await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
    });
  });
});
