import { formatTimeOfDay, parseTimeOfDay } from '@repo/domain';
import * as React from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TimeInputProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'defaultValue'
> {
  /** The text in the field, as typed or as `HH:MM`. */
  value: string;
  onValueChange: (value: string) => void;
  /** Show the format hint under the field, or keep it for screen readers only. */
  hintVisibility?: 'visible' | 'sr-only';
}

/**
 * A 24-hour time of day for the hours tool. The owner types `0830`, `830`,
 * `8:30`, `08.30` or `8`; on blur a readable time is rewritten as `08:30`, and
 * anything else is left exactly as typed for the form to flag. The hint
 * "24-hour, e.g. 08:30" is linked with `aria-describedby`, after any
 * description or error the form links.
 *
 * Keyboard contract: a plain text field (native editing); nothing happens
 * until blur, so typing is never interrupted.
 */
export function TimeInput({
  value,
  onValueChange,
  onBlur,
  hintVisibility = 'visible',
  className,
  'aria-describedby': describedBy,
  ...props
}: TimeInputProps) {
  const hintId = React.useId();
  return (
    <div className="grid gap-1">
      <Input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={(event) => {
          const minutes = parseTimeOfDay(value);
          if (minutes !== null) onValueChange(formatTimeOfDay(minutes));
          onBlur?.(event);
        }}
        aria-describedby={describedBy ? `${describedBy} ${hintId}` : hintId}
        className={cn('w-24 tabular-nums', className)}
        {...props}
      />
      <p
        id={hintId}
        className={hintVisibility === 'visible' ? 'text-muted-foreground text-xs' : 'sr-only'}
      >
        24-hour, e.g. 08:30
      </p>
    </div>
  );
}
