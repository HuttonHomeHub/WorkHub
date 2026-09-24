import { Slot, Slottable } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "focus-ring inline-flex items-center justify-center gap-1.5 rounded-md text-body font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow] select-none disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90',
        outline:
          'border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground border shadow-xs',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      /** 28, 32 (default) and 40px, from the density tokens; `icon` is a 32px square. */
      size: {
        sm: 'h-(--control-sm) px-2.5',
        default: 'h-(--control-md) px-3',
        lg: 'h-(--control-lg) px-4',
        icon: 'size-(--icon-button)',
        'icon-sm': 'size-(--control-sm)',
      },
      /**
       * `true` lets a long label wrap onto more lines instead of widening the
       * page (WCAG 1.4.10 reflow); the button grows taller from its size's height.
       */
      wrap: {
        true: 'h-auto py-1.5 text-left whitespace-normal',
        false: '',
      },
    },
    compoundVariants: [
      { wrap: true, size: 'default', class: 'min-h-(--control-md)' },
      { wrap: true, size: 'sm', class: 'min-h-(--control-sm)' },
      { wrap: true, size: 'lg', class: 'min-h-(--control-lg)' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
      wrap: false,
    },
  },
);

interface ButtonProps
  extends React.ComponentPropsWithoutRef<'button'>, VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a <button> (composition escape hatch). */
  asChild?: boolean;
  /**
   * The action it starts is running: a spinner joins the label (which stays,
   * so the button keeps its name and width), the button is disabled, and it
   * is `aria-busy`.
   */
  isPending?: boolean;
}

/**
 * Button (docs/DESIGN_SYSTEM.md → Button). One primary (`default`) per view;
 * an icon-only button needs `aria-label`.
 *
 * Keyboard contract: Enter and Space activate it (native); focus stays on it.
 * While `isPending`, it is disabled, so a second press does nothing.
 */
function Button({
  className,
  variant,
  size,
  wrap,
  asChild = false,
  isPending = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, wrap }), className)}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      {...props}
    >
      {isPending ? <LoaderCircle aria-hidden data-slot="spinner" className="animate-spin" /> : null}
      <Slottable>{children}</Slottable>
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
