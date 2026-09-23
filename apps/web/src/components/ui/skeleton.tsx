import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Skeleton — a placeholder block for content that is loading for the first
 * time (docs/DESIGN_SYSTEM.md → Skeleton). Size it to the final content so
 * nothing shifts when the data arrives, show it only after 300ms (see
 * `useDelayedFlag`), and never on a refetch of data already on screen.
 *
 * It is decorative (`aria-hidden`): mark the region that is loading with
 * `aria-busy` and give it a text alternative such as "Loading terms".
 */
function Skeleton({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('bg-muted animate-pulse rounded-md motion-reduce:animate-none', className)}
      {...props}
    />
  );
}

export { Skeleton };
