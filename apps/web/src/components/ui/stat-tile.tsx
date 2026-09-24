import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatTileProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'children'> {
  /** What the figure is: the tile's `<dt>`. */
  label: string;
  /** The figure, large, in tabular numerals; `undefined` while it loads. */
  value: React.ReactNode;
  /** A short line under the figure ("of 37:30 target"), read with it. */
  detail?: React.ReactNode;
  /** A decorative bar (ProgressBar) between the figure and its detail. */
  meter?: React.ReactNode;
  /** A decorative icon in the tile's corner. */
  icon?: LucideIcon;
}

/**
 * StatTile — one headline figure as a card (docs/DESIGN_SYSTEM.md →
 * StatTile): its label, the figure large, an optional bar and a detail line.
 * It is a `<dt>`/`<dd>` pair wrapped in a `<div>`, so place tiles in a `<dl>`;
 * the detail sits in the `<dd>`, so a screen reader reads "Credited, 39:00 of
 * 37:30 target".
 */
function StatTile({ label, value, detail, meter, icon: Icon, className, ...props }: StatTileProps) {
  return (
    <div
      data-slot="stat-tile"
      className={cn(
        'bg-card text-card-foreground grid content-start gap-2 rounded-xl border p-4 shadow-xs',
        className,
      )}
      {...props}
    >
      <dt className="text-muted-foreground text-small flex items-center justify-between gap-2 font-medium">
        {label}
        {Icon ? (
          <span
            aria-hidden
            className="bg-highlight text-primary flex size-7 shrink-0 items-center justify-center rounded-lg"
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </dt>
      <dd className="grid gap-2">
        {value === undefined ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <span className="text-figure tabular-nums">{value}</span>
        )}
        {meter}
        {detail ? (
          <span className="text-muted-foreground text-small">
            <span className="sr-only"> </span>
            {detail}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export { StatTile };
