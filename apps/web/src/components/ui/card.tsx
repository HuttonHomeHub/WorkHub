import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Card — a raised surface that groups one thing (docs/DESIGN_SYSTEM.md →
 * Card): `card` fill, a border, `radius-xl` and the hairline `shadow-xs`. At
 * compact density its slots pad 16px (`p-4`); never nest a card in a card.
 *
 * Slots: `CardHeader` (a title over its description), `CardTitle` (an `<h2>` by default; pass `as` to keep the outline
 * right), `CardDescription`, `CardContent`, `CardFooter`.
 */
function Card({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn('bg-card text-card-foreground rounded-xl border shadow-xs', className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('grid gap-1 p-4', className)} {...props} />;
}

interface CardTitleProps extends React.ComponentPropsWithoutRef<'h2'> {
  /** The heading level, so the page's outline never skips one. */
  as?: 'h2' | 'h3';
}

function CardTitle({ className, as: Heading = 'h2', children, ...props }: CardTitleProps) {
  return (
    <Heading className={cn('text-h3', className)} {...props}>
      {children}
    </Heading>
  );
}

function CardDescription({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return <p className={cn('text-muted-foreground text-small', className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('px-4 pb-4', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-2 border-t px-4 py-3', className)}
      {...props}
    />
  );
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
