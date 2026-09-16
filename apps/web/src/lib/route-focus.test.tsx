import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeRouteFocus } from './route-focus';

function Root() {
  const router = useRouter();
  React.useEffect(() => subscribeRouteFocus(router), [router]);
  return <Outlet />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav aria-label="Tools">
        <Link to="/">Home</Link> <Link to={'/hours' as '/'}>Hours</Link>
      </nav>
      <main tabIndex={-1}>{children}</main>
    </>
  );
}

function HoursPage() {
  const navigate = useNavigate();
  return (
    <Shell>
      <h1>Hours page</h1>
      <button
        type="button"
        onClick={() => void navigate({ to: '/hours', search: { week: '2026-10-05' } } as never)}
      >
        Next week
      </button>
    </Shell>
  );
}

function SignInPage() {
  return (
    <div>
      <h2>Sign in</h2>
      <Link to="/">Continue</Link>
    </div>
  );
}

async function renderApp(initialPath: string) {
  const rootRoute = createRootRoute({ component: Root });
  const router = createRouter({
    routeTree: rootRoute.addChildren([
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => (
          <Shell>
            <h1>Home page</h1>
          </Shell>
        ),
      }),
      createRoute({ getParentRoute: () => rootRoute, path: '/hours', component: HoursPage }),
      createRoute({ getParentRoute: () => rootRoute, path: '/sign-in', component: SignInPage }),
    ]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading');
  return router;
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('focus after a route change', () => {
  it('leaves focus alone on the initial page load', async () => {
    await renderApp('/');
    // Let any post-render effects run.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.body).toHaveFocus();
  });

  it('moves focus to main when a link changes the pathname', async () => {
    const user = userEvent.setup();
    await renderApp('/');
    await user.click(screen.getByRole('link', { name: 'Hours' }));
    await screen.findByRole('heading', { name: 'Hours page' });
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());
  });

  it('keeps focus where it is when only search params change', async () => {
    const user = userEvent.setup();
    const router = await renderApp('/hours');
    const next = screen.getByRole('button', { name: 'Next week' });
    await user.click(next);
    await waitFor(() => expect(router.state.location.search).toEqual({ week: '2026-10-05' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(next).toHaveFocus();
  });

  it('moves focus to main when crossing from a page without main into the shell', async () => {
    const user = userEvent.setup();
    const router = await renderApp('/sign-in');
    await user.click(screen.getByRole('link', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Home page' });
    await waitFor(() => expect(screen.getByRole('main')).toHaveFocus());

    // And back out: a page without main focuses its first heading.
    await router.navigate({ to: '/sign-in' } as never);
    const heading = await screen.findByRole('heading', { name: 'Sign in' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(heading).toHaveAttribute('tabindex', '-1');
  });
});
