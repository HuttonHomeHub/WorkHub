import { type VariantProps } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { fieldVariants } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface NativeSelectProps
  extends Omit<React.ComponentProps<'select'>, 'size'>, VariantProps<typeof fieldVariants> {}

/**
 * NativeSelect — a styled native `<select>` for a short, fixed list of options
 * (docs/DESIGN_SYSTEM.md → NativeSelect). It matches `Input`, sizes included,
 * and the browser supplies the popup, typeahead and screen-reader support.
 *
 * Keyboard contract: the browser's own. ↑/↓ change the value (Firefox and
 * Chromium on Windows and Linux), Alt+↓ or Space opens the list, typing a letter
 * jumps to a matching option, Esc closes the list; focus stays on the select.
 */
function NativeSelect({ className, size, children, ...props }: NativeSelectProps) {
  return (
    <div className="relative">
      <select className={cn(fieldVariants({ size }), 'appearance-none pr-8', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
      />
    </div>
  );
}

export { NativeSelect };
