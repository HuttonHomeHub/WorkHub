import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit max-w-full items-center gap-1 rounded-md border px-1.5 py-px text-meta font-medium whitespace-normal [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** A neutral label: "Bank holiday · 7:30 credited", "Upcoming". */
        default: 'bg-secondary text-secondary-foreground border-transparent',
        outline: 'border-input text-foreground',
        /** A filled accent tag for the one current thing: "Today". */
        primary: 'bg-primary text-primary-foreground border-transparent',
        /** Something to act on: a soft amber fill with a ⚠ icon. */
        warning: 'bg-warning-soft text-warning-text border-transparent',
        /** A note, for information only. */
        info: 'bg-info-soft text-info-text border-transparent',
        success: 'bg-success-soft text-success-text border-transparent',
        destructive: 'bg-destructive-soft text-destructive-text border-transparent',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps
  extends React.ComponentPropsWithoutRef<'span'>, VariantProps<typeof badgeVariants> {}

/**
 * Badge — a short, non-interactive status label (docs/DESIGN_SYSTEM.md →
 * Badge): a 12px tag, sized to its text. Its meaning is always in its text
 * (an icon may join it, marked `aria-hidden`), never in its colour alone. It
 * wraps rather than widening a table cell at the reflow floor. Not focusable;
 * it has no keyboard contract.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants, type BadgeProps };
