import type * as React from 'react';

import { cn } from '@/lib/utils';

interface SectionCardProps extends Omit<React.ComponentPropsWithoutRef<'section'>, 'title'> {
  /** The heading's id; the section is labelled by it. */
  headingId: string;
  title: React.ReactNode;
  /** The heading level, so the page's outline never skips one. */
  level?: 'h2' | 'h3';
  /** A line or two of muted text under the title. */
  description?: React.ReactNode;
  /** Controls on the header's right, such as a year navigator's import button. */
  actions?: React.ReactNode;
  /** The content runs to the card's edges (a table), under a rule. */
  flush?: boolean;
}

/**
 * A settings group as a card (docs/features/app-shell-refresh.md → Settings):
 * a `<section>` labelled by its heading, the title and description in the
 * header, optional actions on the right, then the content, padded or flush.
 */
export function SectionCard({
  headingId,
  title,
  level: Heading = 'h2',
  description,
  actions,
  flush = false,
  className,
  children,
  ...props
}: SectionCardProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn('bg-card text-card-foreground rounded-xl border shadow-xs', className)}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4">
        <div className="grid min-w-0 gap-1">
          <Heading id={headingId} className="text-h3">
            {title}
          </Heading>
          {description ? (
            <div className="text-muted-foreground text-small max-w-(--width-prose)">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={flush ? 'border-t' : 'px-4 pb-4'}>{children}</div>
    </section>
  );
}
