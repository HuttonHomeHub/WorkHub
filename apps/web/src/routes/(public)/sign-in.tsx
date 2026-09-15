import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ensureAuthConfig, ensureSession, SignInForm, useAuthConfig } from '@/features/auth';

const searchSchema = z.object({
  /** Where to go after signing in (set by the auth guard). */
  redirect: z.string().optional(),
});

export const Route = createFileRoute('/(public)/sign-in')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context }) => {
    // Load the public config up front so the page renders without a flash.
    const [session] = await Promise.all([
      ensureSession(context.queryClient),
      ensureAuthConfig(context.queryClient),
    ]);
    // Already signed in? Straight to the app.
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- thrown redirects are the TanStack Router control-flow idiom
    if (session) throw redirect({ to: '/' });
  },
  component: SignInPage,
});

function SignInPage() {
  const { redirect: redirectTo } = Route.useSearch();
  const navigate = useNavigate();
  const { data: config } = useAuthConfig();
  return (
    <div className="bg-background text-foreground flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back. Enter your details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SignInForm onSuccess={() => void navigate({ to: redirectTo ?? '/' })} />
          {/* Public sign-up is off unless the API enables it (ADR-0018). */}
          {config?.signUpEnabled ? (
            <p className="text-muted-foreground text-center text-sm">
              No account?{' '}
              <Link
                to="/sign-up"
                className="text-primary font-medium underline-offset-4 hover:underline"
              >
                Create one
              </Link>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
