import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex max-w-full items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium whitespace-normal [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-input text-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        info: 'border-transparent bg-info text-info-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps
  extends React.ComponentPropsWithoutRef<'span'>, VariantProps<typeof badgeVariants> {}

/**
 * Badge — a short, non-interactive status label (docs/DESIGN_SYSTEM.md →
 * Badge). Its meaning is always in its text (an icon may join it, marked
 * `aria-hidden`), never in its colour alone. It wraps rather than widening a
 * table cell at the reflow floor. Not focusable; it has no keyboard contract.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants, type BadgeProps };
