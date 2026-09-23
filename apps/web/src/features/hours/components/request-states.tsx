import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { useDelayedFlag } from '@/hooks/use-delayed-flag';
import { ApiRequestError } from '@/lib/api/client';

/**
 * Loading: nothing for 300ms, then skeleton rows at the final row height, so
 * a fast load never flashes and a slow one does not shift the layout
 * (docs/UX_STANDARDS.md → Timing). The region is `aria-busy` with a text
 * alternative for screen readers.
 */
export function LoadingRows({ label, rows = 3 }: { label: string; rows?: number }) {
  const show = useDelayedFlag(true);
  return (
    <div aria-busy="true" className="grid gap-2">
      <span className="sr-only">{label}</span>
      {show
        ? Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-8" />)
        : null}
    </div>
  );
}

/** A section that failed to load: what happened, and Retry, in place of the content. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="destructive">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
        {message}
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

interface SaveErrorAlertProps {
  error: unknown;
  /** What a 409 means here: a stale version, or a duplicate. */
  conflictMessage: string;
  /** For a stale version: reloads the latest data (shown as a button). */
  onReload?: () => void;
}

/** The detail lines of a 422: the API's validation messages, if it sent any. */
function detailsOf(error: ApiRequestError): string[] {
  return Array.isArray(error.details)
    ? error.details.filter((detail): detail is string => typeof detail === 'string')
    : [];
}

/**
 * A failed save, at the top of its form (docs/UX_STANDARDS.md → Forms): a 422
 * shows the API's message and its `details`; a 409 explains the conflict and,
 * for a stale version, offers to reload; anything else says what to do next.
 */
export function SaveErrorAlert({ error, conflictMessage, onReload }: SaveErrorAlertProps) {
  if (error instanceof ApiRequestError && error.status === 422) {
    const details = detailsOf(error);
    return (
      <Alert variant="destructive">
        <AlertTitle>{error.message}</AlertTitle>
        {details.length > 0 ? (
          <AlertDescription>
            <ul className="list-disc pl-4">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </AlertDescription>
        ) : null}
      </Alert>
    );
  }
  if (error instanceof ApiRequestError && error.status === 409) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-wrap items-center justify-between gap-4">
          {conflictMessage}
          {onReload ? (
            <Button variant="outline" size="sm" onClick={onReload}>
              Reload the latest
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertDescription>
        We couldn&apos;t save your changes. Check your connection and try again.
      </AlertDescription>
    </Alert>
  );
}

/** A short message for a failed action outside a form (for an error toast). */
export function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError && error.status < 500 && error.status !== 401) {
    return error.message;
  }
  return fallback;
}

/**
 * An error toast for a save made outside a form (a toggle, a row's action). A
 * 409 says the data changed elsewhere and offers Reload; errors persist until
 * dismissed.
 */
export function toastSaveError(title: string, error: unknown, onReload?: () => void): void {
  const conflict = error instanceof ApiRequestError && error.status === 409;
  toast({
    variant: 'error',
    title,
    description: conflict
      ? 'It was changed somewhere else. Reload the latest, then try again.'
      : actionErrorMessage(error, 'Try again in a moment.'),
    ...(conflict && onReload
      ? { action: { label: 'Reload', altText: 'Reload the latest data', onAction: onReload } }
      : {}),
  });
}
