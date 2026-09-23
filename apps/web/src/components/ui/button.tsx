import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3',
        lg: 'h-10 rounded-md px-6',
        icon: 'size-9',
      },
      /**
       * `true` lets a long label wrap onto more lines instead of widening the
       * page (WCAG 1.4.10 reflow); the button grows taller from its size's height.
       */
      wrap: {
        true: 'h-auto whitespace-normal text-left',
        false: '',
      },
    },
    compoundVariants: [
      { wrap: true, size: 'default', class: 'min-h-9' },
      { wrap: true, size: 'sm', class: 'min-h-8' },
      { wrap: true, size: 'lg', class: 'min-h-10' },
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
}

function Button({ className, variant, size, wrap, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, wrap }), className)} {...props} />;
}

export { Button, buttonVariants, type ButtonProps };
