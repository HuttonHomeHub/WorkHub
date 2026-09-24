import type * as React from 'react';

import { cn } from '@/lib/utils';

interface PageHeaderProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'title'> {
  /** The page's one `<h1>`. */
  title: React.ReactNode;
  /** A line of muted text under the title. */
  description?: React.ReactNode;
  /** The page's actions, right-aligned: one primary, the rest secondary. */
  actions?: React.ReactNode;
}

/**
 * PageHeader — the page scaffold's header (docs/UX_STANDARDS.md → App shell):
 * the `<h1>` with an optional description on the left, and the actions on the
 * right. They wrap under the title when both do not fit, down to the reflow
 * floor.
 */
export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}
      {...props}
    >
      <div className="grid min-w-0 gap-1">
        <h1 className="text-h1">{title}</h1>
        {description ? (
          <p className="text-muted-foreground text-body max-w-(--width-prose)">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
