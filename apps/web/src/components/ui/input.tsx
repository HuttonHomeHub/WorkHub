import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The shared look of a text field, used by `Input` and `NativeSelect`: an
 * `input` border (3:1 on every surface), a `card` fill, the one focus ring, and
 * the error border when `aria-invalid`.
 */
const fieldVariants = cva(
  'focus-ring border-input bg-card text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive-text read-only:bg-muted flex w-full min-w-0 rounded-md border text-body shadow-xs transition-[color,background-color,border-color] disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      /** 28, 32 (default) and 40px, matching `Button`'s sizes. */
      size: {
        sm: 'h-(--control-sm) px-2',
        default: 'h-(--control-md) px-2.5',
        lg: 'h-(--control-lg) px-3',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

interface InputProps
  extends Omit<React.ComponentProps<'input'>, 'size'>, VariantProps<typeof fieldVariants> {}

/**
 * Input — a single-line text field (docs/DESIGN_SYSTEM.md → Input). Always
 * bound to a label.
 *
 * Keyboard contract: native editing; Enter submits a single-line form.
 */
function Input({ className, type, size, ...props }: InputProps) {
  return <input type={type} className={cn(fieldVariants({ size }), className)} {...props} />;
}

export { fieldVariants, Input, type InputProps };
