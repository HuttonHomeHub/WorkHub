import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';

import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { ensureSession, useSession, useSignOut } from '@/features/auth';

/**
 * Auth guard layout (docs/FRONTEND_ARCHITECTURE.md → Authentication flow).
 * `beforeLoad` validates the session cookie server-side before rendering any
 * child route; unauthenticated users are redirected to sign-in with the
 * original destination. The API independently re-checks every request — this
 * guard is UX, not the trust boundary.
 */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const session = await ensureSession(context.queryClient);
    if (!session) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- thrown redirects are the TanStack Router control-flow idiom
      throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    }
  },
  component: AuthedLayout,
});

function SignOutButton() {
  const signOut = useSignOut();
  const navigate = useNavigate();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={signOut.isPending}
      onClick={() => {
        signOut.mutate(undefined, {
          onSuccess: () => void navigate({ to: '/sign-in' }),
        });
      }}
    >
      Sign out
    </Button>
  );
}

function AuthedLayout() {
  const { data: user } = useSession();
  return (
    <AppShell
      actions={
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm sm:inline">{user?.email}</span>
          <SignOutButton />
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
