import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * NativeSelect — a styled native `<select>` for a short, fixed list of options
 * (docs/DESIGN_SYSTEM.md → NativeSelect). It matches `Input`, and the browser
 * supplies the popup, typeahead and screen-reader support.
 *
 * Keyboard contract: the browser's own. ↑/↓ change the value (Firefox and
 * Chromium on Windows and Linux), Alt+↓ or Space opens the list, typing a letter
 * jumps to a matching option, Esc closes the list; focus stays on the select.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        className={cn(
          'border-input bg-background focus-visible:ring-ring aria-invalid:border-destructive flex h-9 w-full appearance-none rounded-md border py-1 pr-8 pl-3 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
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
