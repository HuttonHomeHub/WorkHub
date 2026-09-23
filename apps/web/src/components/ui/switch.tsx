import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Switch — an on/off setting (docs/DESIGN_SYSTEM.md → Switch). A switch that
 * saves on its own shows a quiet "Saved" beside it; inside an explicit-save
 * form it is just a field (docs/UX_STANDARDS.md → Forms). Label it with a
 * `<Label htmlFor>` or `aria-label`.
 *
 * Keyboard contract: Space toggles it (Enter too, as a native button); focus
 * stays on the switch. It is `role="switch"` with `aria-checked`, and its
 * state shows by the thumb's position as well as the track's colour.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer focus-visible:ring-ring focus-visible:ring-offset-background data-[state=checked]:bg-primary data-[state=unchecked]:border-muted-foreground data-[state=unchecked]:bg-background inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-4 rounded-full shadow-sm transition-transform',
          'data-[state=checked]:bg-primary-foreground data-[state=checked]:translate-x-4',
          'data-[state=unchecked]:bg-muted-foreground data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
