import type { LucideIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

interface EmptyStateProps extends Omit<React.ComponentPropsWithoutRef<'div'>, 'title'> {
  /** A Lucide icon for the situation; decorative. */
  icon: LucideIcon;
  /** What is (not) here, in a sentence. */
  title: React.ReactNode;
  /** What to do about it. */
  description?: React.ReactNode;
  /** The one way forward, usually a Button. */
  action?: React.ReactNode;
}

/**
 * EmptyState — a designed "nothing here yet" (docs/DESIGN_SYSTEM.md → Empty
 * state): a muted icon tile, the situation in a sentence, a line on what to
 * do, and at most one action. It is not a live region; it stands in for the
 * content it replaces.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center gap-3 px-4 py-10 text-center', className)}
      {...props}
    >
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="grid max-w-(--width-prose) gap-1">
        <p className="text-lead font-medium">{title}</p>
        {description ? <p className="text-muted-foreground text-body">{description}</p> : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
