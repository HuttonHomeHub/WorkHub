import { formatFlexi } from '@repo/domain';

import { cn } from '@/lib/utils';

/**
 * A flexi figure with its direction in words and a status colour
 * (docs/features/app-shell-refresh.md): `+1:30 over` in `success-text`,
 * `−2:00 under` in `warning-text`, `0:00` in the text colour around it. The
 * sign and the word carry the meaning; the colour only repeats it (WCAG 1.4.1).
 * `pill` sets it on its status's soft fill, for a day's figure in the table.
 */
export function FlexiValue({
  minutes,
  pill = false,
  className,
}: {
  minutes: number;
  /** On its status's soft fill, as a rounded pill (a table row's figure). */
  pill?: boolean;
  className?: string;
}) {
  return (
    <span
      data-direction={minutes > 0 ? 'over' : minutes < 0 ? 'under' : 'level'}
      className={cn(
        minutes > 0 && 'text-success-text',
        minutes < 0 && 'text-warning-text',
        pill && 'rounded-full px-2 py-0.5 font-medium',
        pill && (minutes > 0 ? 'bg-success-soft' : minutes < 0 ? 'bg-warning-soft' : 'bg-muted'),
        'whitespace-nowrap tabular-nums',
        className,
      )}
    >
      {formatFlexi(minutes)}
    </span>
  );
}
