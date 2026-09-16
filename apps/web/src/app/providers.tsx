import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ThemeProvider } from '@/hooks/use-theme';

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort error boundary (docs/FRONTEND_ARCHITECTURE.md → Error handling).
 * Route-level errors are handled by the router; this catches anything above it.
 */
class RootErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Telemetry facade lands with observability wiring (docs/FRONTEND_QUALITY.md).
    console.error('Unhandled error', error, info);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-4">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">Reload the page to continue.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ProvidersProps {
  queryClient: QueryClient;
  children: React.ReactNode;
}

/** App-wide composition: error boundary → theme → server-state cache → tooltips. */
export function Providers({ queryClient, children }: ProvidersProps) {
  return (
    <RootErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>{children}</TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </RootErrorBoundary>
  );
}
