import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet, useRouter } from '@tanstack/react-router';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { subscribeRouteFocus } from '@/lib/route-focus';

interface RouterContext {
  queryClient: QueryClient;
}

/**
 * Root layout: children render into the outlet; providers live in main.tsx.
 * It also moves focus after in-app route changes, for public and signed-in
 * pages alike (lib/route-focus.ts).
 */
function RootLayout() {
  const router = useRouter();
  React.useEffect(() => subscribeRouteFocus(router), [router]);
  return <Outlet />;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground text-sm">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Button asChild variant="outline">
        <Link to="/">Go home</Link>
      </Button>
    </div>
  ),
});
