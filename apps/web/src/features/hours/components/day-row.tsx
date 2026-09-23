import {
  formatDuration,
  formatFlexi,
  type ConversionState,
  type DayResult,
  type IsoDate,
} from '@repo/domain';
import { Ellipsis, Info, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { endsNextDay, type RowField, type RowText } from '../schemas/work-day';
import type { RowWarning } from '../week/week-calculation';

import { DurationInput } from './duration-input';
import { TimeInput } from './time-input';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/** The id of a row's field, so the page can focus it ("Go to today", after Clear day). */
export function fieldId(field: RowField, date: IsoDate): string {
  return `hours-${field}-${date}`;
}

const FIELD_LABELS: Record<RowField, string> = {
  start: 'Start',
  end: 'End',
  break: 'Break',
  leave: 'Leave',
  toil: 'TOIL taken',
};

export interface DayRowProps {
  date: IsoDate;
  /** "Mon 5 Oct". */
  label: string;
  isToday: boolean;
  text: RowText;
  /** The row differs from what is saved. */
  dirty: boolean;
  /** The date has a saved row (so Clear day deletes it). */
  hasSaved: boolean;
  day: DayResult;
  warnings: readonly RowWarning[];
  /** The week's conversion; the Converted column shows unless it is `OFF`. */
  conversion: ConversionState;
  /** Errors for the fields the owner has left (or tried to save). */
  fieldErrors: Partial<Record<RowField, string>>;
  /** The API's reasons for refusing the last save (a 422). */
  saveErrors: readonly string[] | undefined;
  saving: boolean;
  /** The table's column count, for the error row's span. */
  columns: number;
  onFieldChange: (field: RowField, value: string) => void;
  onFieldBlur: (field: RowField) => void;
  onSave: () => void;
  onRevert: () => void;
  onClear: () => void;
  onToggleBankHolidayWorked: () => void;
  /**
   * Called as a menu closes after Clear day: return the element to focus
   * instead of the menu's trigger (focus moves to the next row).
   */
  focusAfterMenu: () => HTMLElement | null;
}

/** A dash for "nothing here", read as `none` by screen readers. */
function Empty({ label = 'None' }: { label?: string }) {
  return (
    <>
      <span aria-hidden>—</span>
      <span className="sr-only">{label}</span>
    </>
  );
}

interface RowMenuItem {
  label: string;
  onSelect: () => void;
}

/**
 * One day of the week view: a small form (docs/features/hours-tracker.md → UI,
 * "Rows are small forms"). Tab moves Start → End → Break → Leave → TOIL taken
 * → (Save) → the row menu.
 *
 * Keyboard contract: **Enter** in any field saves the row, **Esc** reverts it
 * to what is saved (both only while focus is in the row's fields). The "⋯"
 * button opens the row menu (DropdownMenu); right-click on the row opens the
 * same menu (ContextMenu), except in a text field, which keeps the browser's
 * own menu for copy and paste. Validation shows when a field is left and on
 * save; nothing blocks typing.
 */
export function DayRow({
  date,
  label,
  isToday,
  text,
  dirty,
  hasSaved,
  day,
  warnings,
  conversion,
  fieldErrors,
  saveErrors,
  saving,
  columns,
  onFieldChange,
  onFieldBlur,
  onSave,
  onRevert,
  onClear,
  onToggleBankHolidayWorked,
  focusAfterMenu,
}: DayRowProps) {
  const headerId = `hours-day-${date}`;
  const nextDayId = `hours-next-day-${date}`;
  const saveErrorId = `hours-save-error-${date}`;
  const overnight = endsNextDay(text);

  const menuItems: RowMenuItem[] = [];
  if (hasSaved || dirty) menuItems.push({ label: 'Clear day', onSelect: onClear });
  if (day.bankHoliday) {
    menuItems.push({
      label: text.bankHolidayWorked
        ? 'Mark bank holiday as not worked'
        : 'Mark bank holiday as worked',
      onSelect: onToggleBankHolidayWorked,
    });
  }

  const closeAutoFocus = (event: Event) => {
    const target = focusAfterMenu();
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onSave();
    } else if (event.key === 'Escape' && dirty) {
      event.preventDefault();
      onRevert();
    }
  };

  const field = (name: RowField) => {
    const error = fieldErrors[name];
    const errorId = `${fieldId(name, date)}-error`;
    const describedBy = [
      error ? errorId : null,
      name === 'end' ? nextDayId : null,
      saveErrors ? saveErrorId : null,
    ]
      .filter(Boolean)
      .join(' ');
    const common = {
      id: fieldId(name, date),
      value: text[name],
      onValueChange: (value: string) => onFieldChange(name, value),
      onBlur: () => onFieldBlur(name),
      onKeyDown,
      // Keep the browser's own menu (copy, paste) in a text field.
      onContextMenu: (event: React.MouseEvent) => event.stopPropagation(),
      'aria-label': `${FIELD_LABELS[name]}, ${label}`,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy || undefined,
      hintVisibility: 'sr-only' as const,
      className: 'w-18',
    };
    return (
      <td className="px-1 py-1 align-top">
        {name === 'start' || name === 'end' ? (
          <TimeInput {...common} />
        ) : (
          <DurationInput {...common} />
        )}
        {name === 'end' ? (
          <span id={nextDayId} aria-live="polite" className="block text-xs font-medium">
            {overnight ? '+1 day' : ''}
          </span>
        ) : null}
        {error ? (
          <p id={errorId} className="text-destructive mt-1 max-w-24 text-xs">
            {error}
          </p>
        ) : null}
      </td>
    );
  };

  const convertedMinutes =
    conversion === 'APPLIED' ? day.convertedMinutes : day.previewConvertedMinutes;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <tr className={cn('border-b', saveErrors && 'border-b-0')} data-date={date}>
            <th
              scope="row"
              id={headerId}
              className="py-1 pr-3 text-left align-top font-medium"
              aria-current={isToday ? 'date' : undefined}
            >
              <div className="flex min-h-9 flex-col justify-center gap-1">
                <span className="whitespace-nowrap tabular-nums">{label}</span>
                {isToday ? <Badge variant="outline">Today</Badge> : null}
                {dirty ? (
                  <span className="text-muted-foreground text-xs font-normal">Unsaved</span>
                ) : null}
                {day.bankHoliday ? (
                  <Badge>
                    {day.bankHolidayMinutes > 0
                      ? `Bank holiday · ${formatDuration(day.bankHolidayMinutes)} credited`
                      : 'Bank holiday · worked'}
                  </Badge>
                ) : null}
              </div>
            </th>
            {field('start')}
            {field('end')}
            {field('break')}
            {field('leave')}
            {field('toil')}
            <td className="px-2 py-1 text-right align-top tabular-nums">
              <div className="flex min-h-9 items-center justify-end">
                {day.spanMinutes > 0 ? formatDuration(day.workedMinutes) : <Empty />}
              </div>
            </td>
            <td className="px-2 py-1 text-right align-top tabular-nums">
              <div className="flex min-h-9 items-center justify-end">
                {day.creditedMinutes > 0 ? formatDuration(day.creditedMinutes) : <Empty />}
              </div>
            </td>
            <td className="px-2 py-1 text-right align-top whitespace-nowrap tabular-nums">
              <div className="flex min-h-9 items-center justify-end">
                {day.counted ? formatFlexi(day.dayFlexiMinutes) : <Empty label="Not counted yet" />}
              </div>
            </td>
            {conversion !== 'OFF' ? (
              <td className="px-2 py-1 text-right align-top tabular-nums">
                <div className="flex min-h-9 items-center justify-end">
                  {convertedMinutes > 0 ? formatDuration(convertedMinutes) : <Empty />}
                </div>
              </td>
            ) : null}
            <td className="px-2 py-1 align-top">
              {warnings.length > 0 ? (
                <ul className="grid min-h-9 content-center gap-0.5 text-xs">
                  {warnings.map((warning) => (
                    <li key={warning.text} className="flex items-start gap-1">
                      {warning.kind === 'warning' ? (
                        <>
                          <TriangleAlert
                            aria-hidden
                            className="text-warning mt-px size-3.5 shrink-0"
                          />
                          <span className="sr-only">Warning: </span>
                        </>
                      ) : (
                        <>
                          <Info aria-hidden className="text-info mt-px size-3.5 shrink-0" />
                          <span className="sr-only">Note: </span>
                        </>
                      )}
                      <span>{warning.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </td>
            <td className="py-1 pl-2 align-top">
              <div className="flex min-h-9 items-center justify-end gap-2">
                {dirty ? (
                  <Button size="sm" onClick={onSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                    <span className="sr-only"> {label}</span>
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${label}`}
                      disabled={menuItems.length === 0}
                    >
                      <Ellipsis aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent onCloseAutoFocus={closeAutoFocus}>
                    {menuItems.map((item) => (
                      <DropdownMenuItem key={item.label} onSelect={item.onSelect}>
                        {item.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </td>
          </tr>
        </ContextMenuTrigger>
        {menuItems.length > 0 ? (
          <ContextMenuContent onCloseAutoFocus={closeAutoFocus} aria-label={`Actions for ${label}`}>
            {menuItems.map((item) => (
              <ContextMenuItem key={item.label} onSelect={item.onSelect}>
                {item.label}
              </ContextMenuItem>
            ))}
          </ContextMenuContent>
        ) : null}
      </ContextMenu>
      {saveErrors ? (
        <tr className="border-b">
          <td colSpan={columns} className="pb-2">
            <div id={saveErrorId} role="alert" className="text-destructive text-sm">
              <p className="font-medium">We couldn&apos;t save {label}.</p>
              <ul className="list-disc pl-4">
                {saveErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
