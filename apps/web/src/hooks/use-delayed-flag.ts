import * as React from 'react';

/** Nothing spins before this (docs/UX_STANDARDS.md → Timing). */
export const PENDING_DELAY_MS = 300;

/**
 * True once `active` has stayed true for `delayMs`, and false again as soon as
 * it is false. Use it to show a skeleton only for a load slow enough to
 * notice, so a fast one never flashes.
 */
export function useDelayedFlag(active: boolean, delayMs = PENDING_DELAY_MS): boolean {
  const [elapsed, setElapsed] = React.useState(false);
  React.useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setElapsed(true), delayMs);
    return () => {
      window.clearTimeout(timer);
      setElapsed(false);
    };
  }, [active, delayMs]);
  return active && elapsed;
}
