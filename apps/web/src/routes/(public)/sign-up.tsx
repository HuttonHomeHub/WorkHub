import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ensureAuthConfig, ensureSession, SignUpForm } from '@/features/auth';

export const Route = createFileRoute('/(public)/sign-up')({
  beforeLoad: async ({ context }) => {
    const [session, config] = await Promise.all([
      ensureSession(context.queryClient),
      ensureAuthConfig(context.queryClient),
    ]);
    // Already signed in? Straight to the app.
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- thrown redirects are the TanStack Router control-flow idiom
    if (session) throw redirect({ to: '/' });
    // Public sign-up is off unless the API enables it (ADR-0018).
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- thrown redirects are the TanStack Router control-flow idiom
    if (!config.signUpEnabled) throw redirect({ to: '/sign-in' });
  },
  component: SignUpPage,
});

function SignUpPage() {
  const navigate = useNavigate();
  return (
    <div className="bg-background text-foreground flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Sign up with your email and a password.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SignUpForm onSuccess={() => void navigate({ to: '/' })} />
          <p className="text-muted-foreground text-center text-sm">
            Already have an account?{' '}
            <Link
              to="/sign-in"
              className="text-primary font-medium underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
