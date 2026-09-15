import { createFileRoute } from '@tanstack/react-router';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/features/auth';

export const Route = createFileRoute('/_authed/')({
  component: Home,
});

/**
 * The signed-in landing page. Deliberately minimal — the walking skeleton ends
 * here. Real features replace this screen (docs/PROCESS.md, ADR-0015).
 */
function Home() {
  const { data: user } = useSession();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{user ? `, ${user.name}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">You&apos;re signed in as {user?.email}.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Start building</CardTitle>
          <CardDescription>
            This is the walking skeleton: signup, sign-in, sessions, and this protected page all
            work end-to-end. Build your first feature from the reference template.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          <ol className="list-decimal space-y-1 pl-4">
            <li>Follow the delivery process in docs/PROCESS.md (spec → plan → approval).</li>
            <li>Copy the backend template from apps/api/examples/reference-feature/.</li>
            <li>
              Add a feature module under src/features/ following docs/FRONTEND_ARCHITECTURE.md.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
