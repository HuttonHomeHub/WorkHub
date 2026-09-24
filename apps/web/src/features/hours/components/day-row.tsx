import { formatDuration, type ConversionState, type DayResult, type IsoDate } from '@repo/domain';
import { CalendarDays, Ellipsis, Info, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { endsNextDay, type RowField, type RowText } from '../schemas/work-day';
import type { RowWarning } from '../week/week-calculation';

import { DurationInput } from './duration-input';
import { FlexiValue } from './flexi-value';
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
import { TableCell, TableRow, TableRowHeader } from '@/components/ui/table';
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

/** What a row shows of the engine's day, and nothing else (not the running balance). */
export type DayFigures = Pick<
  DayResult,
  | 'bankHoliday'
  | 'bankHolidayMinutes'
  | 'spanMinutes'
  | 'workedMinutes'
  | 'creditedMinutes'
  | 'counted'
  | 'dayFlexiMinutes'
  | 'convertedMinutes'
  | 'previewConvertedMinutes'
>;

/**
 * A row's figures from the engine's day. The day's running flexi balance moves
 * with every earlier day, so passing the whole day would re-render every later
 * row on each keystroke.
 */
export function dayFigures(day: DayResult): DayFigures {
  return {
    bankHoliday: day.bankHoliday,
    bankHolidayMinutes: day.bankHolidayMinutes,
    spanMinutes: day.spanMinutes,
    workedMinutes: day.workedMinutes,
    creditedMinutes: day.creditedMinutes,
    counted: day.counted,
    dayFlexiMinutes: day.dayFlexiMinutes,
    convertedMinutes: day.convertedMinutes,
    previewConvertedMinutes: day.previewConvertedMinutes,
  };
}

export interface DayRowProps {
  date: IsoDate;
  /** "Mon 5 Oct". */
  label: string;
  isToday: boolean;
  /** An odd row of the week, drawn on the zebra stripe (with its notes row). */
  striped: boolean;
  text: RowText;
  /** The row differs from what is saved. */
  dirty: boolean;
  /** The date has a saved row (so Clear day deletes it). */
  hasSaved: boolean;
  /** The engine's figures for the day that the row shows (`dayFigures`). */
  day: DayFigures;
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
  /*
   * The handlers take the row's date, so the table passes the same functions
   * to every row and a keystroke re-renders only the row that changed.
   */
  onFieldChange: (date: IsoDate, field: RowField, value: string) => void;
  onFieldBlur: (date: IsoDate, field: RowField) => void;
  onSave: (date: IsoDate) => void;
  onRevert: (date: IsoDate) => void;
  onClear: (date: IsoDate) => void;
  onToggleBankHolidayWorked: (date: IsoDate) => void;
  /**
   * Called as a menu closes after Clear day: return the element to focus
   * instead of the menu's trigger (focus moves to the next row).
   */
  focusAfterMenu: () => HTMLElement | null;
}

/** Props compared by value: the table rebuilds them on each render. */
const VALUE_PROPS = new Set<string>(['text', 'day', 'warnings', 'fieldErrors', 'saveErrors']);

/**
 * `React.memo`'s comparison for a row: the handlers are stable and the rest
 * are small, so a row re-renders only when something it shows has changed
 * (the engine's result is a new object on every run, even for unchanged days).
 */
function sameRowProps(previous: DayRowProps, next: DayRowProps): boolean {
  return (Object.keys(next) as (keyof DayRowProps)[]).every((key) =>
    VALUE_PROPS.has(key)
      ? JSON.stringify(previous[key]) === JSON.stringify(next[key])
      : Object.is(previous[key], next[key]),
  );
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
 * own menu for copy and paste; a row with no actions keeps the browser's own
 * menu everywhere. Validation shows when a field is left and on save; nothing
 * blocks typing.
 */
function DayRowComponent({
  date,
  label,
  isToday,
  striped,
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
  if (hasSaved || dirty) menuItems.push({ label: 'Clear day', onSelect: () => onClear(date) });
  if (day.bankHoliday) {
    menuItems.push({
      label: text.bankHolidayWorked
        ? 'Mark bank holiday as not worked'
        : 'Mark bank holiday as worked',
      onSelect: () => onToggleBankHolidayWorked(date),
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
      onSave(date);
    } else if (event.key === 'Escape' && dirty) {
      event.preventDefault();
      onRevert(date);
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
      onValueChange: (value: string) => onFieldChange(date, name, value),
      onBlur: () => onFieldBlur(date, name),
      onKeyDown,
      // Keep the browser's own menu (copy, paste) in a text field.
      onContextMenu: (event: React.MouseEvent) => event.stopPropagation(),
      'aria-label': `${FIELD_LABELS[name]}, ${label}`,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy || undefined,
      hintVisibility: 'sr-only' as const,
      size: 'sm' as const,
      className: 'text-small w-(--width-input-compact) px-1.5 text-center',
    };
    return (
      <TableCell className="px-1 align-top">
        {name === 'start' || name === 'end' ? (
          <TimeInput {...common} />
        ) : (
          <DurationInput {...common} />
        )}
        {name === 'end' ? (
          // Not a live region: it would re-announce as a partial time is typed.
          // The End field's description reads it.
          <span id={nextDayId} className="text-muted-foreground text-meta block font-medium">
            {overnight ? '+1 day' : ''}
          </span>
        ) : null}
        {error ? (
          <p id={errorId} className="text-destructive-text text-meta mt-1 max-w-24">
            {error}
          </p>
        ) : null}
      </TableCell>
    );
  };

  const convertedMinutes =
    conversion === 'APPLIED' ? day.convertedMinutes : day.previewConvertedMinutes;

  const tone = isToday ? 'highlight' : striped ? 'stripe' : 'default';
  const onlyNotes = warnings.every((warning) => warning.kind !== 'warning');
  // The day's notes row: its bank holiday, then its warnings and notes.
  const hasNotes = day.bankHoliday || warnings.length > 0;
  // A cell's content, centred on the 28px fields' line whatever else the row holds.
  const figure = (content: React.ReactNode) => (
    <div className="flex min-h-(--control-sm) items-center justify-end">{content}</div>
  );

  return (
    <>
      <ContextMenu>
        {/* Without actions the trigger is off, so right-click and Shift+F10 keep
            the browser's own menu. */}
        <ContextMenuTrigger asChild disabled={menuItems.length === 0}>
          <TableRow
            tone={tone}
            hover={!isToday}
            className={cn((hasNotes || saveErrors) && 'border-b-0')}
            data-date={date}
          >
            <TableRowHeader
              id={headerId}
              className="pr-2 align-top first:pl-3"
              aria-current={isToday ? 'date' : undefined}
            >
              <div className="flex min-h-(--control-sm) flex-col items-start justify-center gap-0.5">
                <span className="whitespace-nowrap tabular-nums">{label}</span>
                {isToday ? <Badge variant="primary">Today</Badge> : null}
                {dirty ? (
                  <span className="text-muted-foreground text-meta font-normal">Unsaved</span>
                ) : null}
              </div>
            </TableRowHeader>
            {field('start')}
            {field('end')}
            {field('break')}
            {field('leave')}
            {field('toil')}
            <TableCell numeric className="px-1 align-top">
              {figure(day.spanMinutes > 0 ? formatDuration(day.workedMinutes) : <Empty />)}
            </TableCell>
            <TableCell numeric className="px-1 align-top">
              {figure(day.creditedMinutes > 0 ? formatDuration(day.creditedMinutes) : <Empty />)}
            </TableCell>
            <TableCell numeric className="px-1 align-top">
              {figure(
                day.counted ? (
                  <FlexiValue minutes={day.dayFlexiMinutes} />
                ) : (
                  <Empty label="Not counted yet" />
                ),
              )}
            </TableCell>
            {conversion !== 'OFF' ? (
              <TableCell numeric className="px-1 align-top">
                {figure(convertedMinutes > 0 ? formatDuration(convertedMinutes) : <Empty />)}
              </TableCell>
            ) : null}
            <TableCell className="pl-1 align-top last:pr-3">
              <div className="flex min-h-(--control-sm) items-center justify-end gap-0.5">
                {dirty ? (
                  <Button
                    size="sm"
                    className="text-small px-2"
                    onClick={() => onSave(date)}
                    isPending={saving}
                  >
                    Save
                    <span className="sr-only"> {label}</span>
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
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
            </TableCell>
          </TableRow>
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
      {hasNotes ? (
        // The day's bank holiday, warnings and notes, in a row of their own
        // under it: chips with an icon and text, never colour alone (rule 13).
        <TableRow tone={tone} hover={false} className={cn(saveErrors && 'border-b-0')}>
          <TableCell colSpan={columns} className="h-auto pt-0 pb-2 first:pl-3">
            <span className="sr-only">
              {onlyNotes ? 'Notes' : 'Warnings'} for {label}:{' '}
            </span>
            <ul className="flex flex-wrap gap-1.5">
              {day.bankHoliday ? (
                <li>
                  <Badge>
                    <CalendarDays aria-hidden />
                    {day.bankHolidayMinutes > 0
                      ? `Bank holiday · ${formatDuration(day.bankHolidayMinutes)} credited`
                      : 'Bank holiday · worked'}
                  </Badge>
                </li>
              ) : null}
              {warnings.map((warning) => (
                <li key={warning.text}>
                  {warning.kind === 'warning' ? (
                    <Badge variant="warning">
                      <TriangleAlert aria-hidden />
                      <span className="sr-only">Warning: </span>
                      {warning.text}
                    </Badge>
                  ) : (
                    <Badge variant="info">
                      <Info aria-hidden />
                      <span className="sr-only">Note: </span>
                      {warning.text}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </TableCell>
        </TableRow>
      ) : null}
      {saveErrors ? (
        <TableRow tone={tone} hover={false}>
          <TableCell colSpan={columns} className="h-auto pt-0 pb-2 first:pl-3">
            <div
              id={saveErrorId}
              role="alert"
              className="bg-destructive-soft text-destructive-text rounded-md px-3 py-2"
            >
              <p className="font-medium">We couldn&apos;t save {label}.</p>
              <ul className="list-disc pl-4">
                {saveErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

/** One day of the week view, memoised by value (`sameRowProps`). */
export const DayRow = React.memo(DayRowComponent, sameRowProps);
