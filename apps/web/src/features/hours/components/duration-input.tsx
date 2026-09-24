import { formatDuration, parseDuration } from '@repo/domain';
import * as React from 'react';

import { parseSignedDuration } from '../schemas/fields';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface DurationInputProps extends Omit<
  React.ComponentProps<'input'>,
  'value' | 'onChange' | 'type' | 'defaultValue' | 'size'
> {
  /** The text in the field, as typed or as `h:mm`. */
  value: string;
  onValueChange: (value: string) => void;
  /** Accept a leading minus sign (`−2:00`), for adjustments. */
  signed?: boolean;
  /** Show the format hint under the field, or keep it for screen readers only. */
  hintVisibility?: 'visible' | 'sr-only';
}

const HINT = 'Hours and minutes, e.g. 7:30, 30m or 7.5h';
const SIGNED_HINT = 'Hours and minutes, e.g. 7:30; a minus subtracts, e.g. −2:00';

/**
 * A duration for the hours tool. The owner types `7:30`, `0:30`, `30m`, `7.5h`
 * or `7.5` (hours); on blur a readable value is rewritten as `h:mm`
 * (`7.5h` → `7:30`), and anything else is left as typed for the form to flag.
 * The format hint is linked with `aria-describedby`, after any description or
 * error the form links. An empty field stays empty ("not set").
 *
 * Keyboard contract: a plain text field (native editing); nothing happens
 * until blur.
 */
export function DurationInput({
  value,
  onValueChange,
  onBlur,
  signed = false,
  hintVisibility = 'visible',
  className,
  'aria-describedby': describedBy,
  ...props
}: DurationInputProps) {
  const hintId = React.useId();
  return (
    <div className="grid gap-1">
      <Input
        type="text"
        inputMode={signed ? 'text' : 'decimal'}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={(event) => {
          const minutes = signed ? parseSignedDuration(value) : parseDuration(value);
          if (value.trim() !== '' && minutes !== null) onValueChange(formatDuration(minutes));
          onBlur?.(event);
        }}
        aria-describedby={describedBy ? `${describedBy} ${hintId}` : hintId}
        className={cn('w-(--width-input-short) tabular-nums', className)}
        {...props}
      />
      <p
        id={hintId}
        className={hintVisibility === 'visible' ? 'text-muted-foreground text-meta' : 'sr-only'}
      >
        {signed ? SIGNED_HINT : HINT}
      </p>
    </div>
  );
}
