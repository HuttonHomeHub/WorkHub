import { createFileRoute } from '@tanstack/react-router';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/features/account';

export const Route = createFileRoute('/_authed/')({
  component: Home,
});

/**
 * The signed-in landing page. Deliberately minimal — the walking skeleton ends
 * here. Real features replace this screen (docs/PROCESS.md, ADR-0015). The
 * profile comes from `GET /api/v1/me` through the typed API client (ADR-0017).
 */
function Home() {
  const me = useMe();
  return (
    <div className="grid max-w-(--width-prose) grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{me.data ? `, ${me.data.name}` : ''}
        </h1>
        {me.data ? (
          <p className="text-muted-foreground text-sm">You&apos;re signed in as {me.data.email}.</p>
        ) : null}
      </div>
      {me.isError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            We couldn&apos;t load your profile.
            <Button variant="outline" size="sm" onClick={() => void me.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
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
            <li>
              Generate the backend feature: <code>pnpm gen:feature &lt;entity-name&gt;</code>.
            </li>
            <li>
              Add a feature module under src/features/ following docs/FRONTEND_ARCHITECTURE.md.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
