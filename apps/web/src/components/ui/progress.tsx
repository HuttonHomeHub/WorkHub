import * as React from 'react';

import { cn } from '@/lib/utils';

interface ProgressBarProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** How far along, in any unit. */
  value: number;
  /** The whole, in the same unit; a bar with nothing to reach shows empty. */
  max: number;
}

/**
 * ProgressBar — a slim bar showing how much of a whole is done, such as
 * credited time against the week's target (docs/DESIGN_SYSTEM.md →
 * ProgressBar). It is **decorative** (`aria-hidden`): the figure beside it
 * ("18:30 of 37:30 target") carries the meaning, so the bar never has to be
 * read. Reaching the whole turns it from the accent to `success`.
 *
 * The fill's width is the one inline style it sets: a data value, not a
 * theme value.
 */
function ProgressBar({ value, max, className, ...props }: ProgressBarProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const complete = max > 0 && value >= max;
  return (
    <div
      aria-hidden
      data-complete={complete || undefined}
      className={cn('bg-muted h-1.5 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-(--duration-slow) ease-out',
          complete ? 'bg-success' : 'bg-primary',
        )}
        style={{ width: `${String(Math.round(ratio * 1000) / 10)}%` }}
      />
    </div>
  );
}

export { ProgressBar };
