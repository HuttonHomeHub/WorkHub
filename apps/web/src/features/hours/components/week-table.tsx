import { formatDuration, type IsoDate, type WorkDayRow, type WorkTerms } from '@repo/domain';
import { useBlocker } from '@tanstack/react-router';
import * as React from 'react';

import {
  useCreateWorkDay,
  useDeleteWorkDay,
  useRestoreWorkDay,
  useUpdateWorkDay,
  type WorkDay,
} from '../api/work-days';
import {
  parseRow,
  ROW_FIELDS,
  sameRow,
  textFromSaved,
  type RowField,
  type RowText,
} from '../schemas/work-day';
import {
  calculateWeek,
  rowWarnings,
  weekTotals,
  type WeekCalculation,
} from '../week/week-calculation';
import { weekDates } from '../week/week-dates';

import { DayRow, dayFigures, fieldId } from './day-row';
import { FlexiValue } from './flexi-value';
import { actionErrorMessage, toastSaveError } from './request-states';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { ApiRequestError } from '@/lib/api/client';
import { formatDate } from '@/lib/format';

/** A row the owner has typed in: its text, the fields they have left, and a refused save. */
interface Draft {
  text: RowText;
  touched: ReadonlySet<RowField>;
  saveErrors?: readonly string[] | undefined;
}

/** A saved work day as the engine reads it. */
export function toEngineDay(day: WorkDay): WorkDayRow {
  return {
    date: day.date,
    startsAt: day.startsAt,
    endsAt: day.endsAt,
    breakMinutes: day.breakMinutes,
    leaveMinutes: day.leaveMinutes,
    toilTakenMinutes: day.toilTakenMinutes,
    bankHolidayWorked: day.bankHolidayWorked,
  };
}

/**
 * A function that keeps its identity across renders but always runs the
 * latest `handler` (it is refreshed after each render), for handlers passed
 * to memoised rows. Call it from events only, never while rendering.
 */
function useStableHandler<Args extends unknown[]>(
  handler: (...args: Args) => void,
): (...args: Args) => void {
  const latest = React.useRef(handler);
  React.useLayoutEffect(() => {
    latest.current = handler;
  });
  return React.useCallback((...args: Args) => latest.current(...args), []);
}

/** The reasons in a 422, or its message when it has none. */
function refusalReasons(error: ApiRequestError): string[] {
  const details = Array.isArray(error.details)
    ? error.details.filter((detail): detail is string => typeof detail === 'string')
    : [];
  return details.length > 0 ? details : [error.message];
}

/**
 * The table's column headers, in order (the Converted column is optional).
 * A day's warnings and notes sit in a row of their own under it
 * (`DayRow`), not in a column, so the table fits beside the aside at 1280px.
 */
function columnsFor(converting: boolean) {
  return [
    { key: 'day', label: 'Day', numeric: false },
    { key: 'start', label: 'Start', numeric: false },
    { key: 'end', label: 'End', numeric: false },
    { key: 'break', label: 'Break', numeric: false },
    { key: 'leave', label: 'Leave', numeric: false },
    { key: 'toil', label: 'TOIL taken', numeric: false },
    { key: 'worked', label: 'Worked', numeric: true },
    { key: 'credited', label: 'Credited', numeric: true },
    { key: 'flexi', label: 'Flexi', numeric: true },
    ...(converting ? [{ key: 'converted', label: 'Converted', numeric: true }] : []),
  ];
}

/** The table's head: shared by the loaded table and its loading and error states. */
export function WeekTableHead({
  converting = false,
  preview = false,
}: {
  converting?: boolean;
  preview?: boolean;
}) {
  return (
    <TableHeader>
      <TableRow hover={false}>
        {columnsFor(converting).map((column) => (
          <TableHead
            key={column.key}
            numeric={column.numeric}
            // Field headers wrap ("TOIL taken") to the fields' width.
            className={column.numeric ? 'px-1' : 'px-1 whitespace-normal first:pr-2 first:pl-3'}
          >
            {column.label}
            {column.key === 'converted' && preview ? (
              <>
                {' '}
                <span className="text-meta block font-normal">(preview)</span>
              </>
            ) : null}
          </TableHead>
        ))}
        <TableHead className="w-full pl-1 last:pr-3">
          <span className="sr-only">Actions</span>
        </TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** How many columns the table has (for a cell spanning it). */
export function columnCount(converting: boolean): number {
  return columnsFor(converting).length + 1;
}

export interface WeekTableProps {
  weekStart: IsoDate;
  /** Today in Europe/London. */
  today: IsoDate;
  /** Every active set of terms, in engine form. */
  terms: readonly WorkTerms[];
  /** The week's saved days. */
  savedDays: readonly WorkDay[];
  /** Whether the week's conversion switch is on. */
  converting: boolean;
  /** Bank holiday dates covering the week. */
  publicHolidays: readonly IsoDate[];
  /** The id of the table's heading ("Week of 5 Oct 2026"). */
  labelledBy: string;
  /** A date whose Start field should take focus once shown ("Go to today"). */
  focusDate: IsoDate | null;
  onFocusDone: () => void;
  /** Reloads the week's saved days (after a 409). */
  onReload: () => void;
  /** The live calculation (saved rows plus readable unsaved ones), for the aside. */
  onCalculated?: (calculation: WeekCalculation | null) => void;
  /**
   * Called as a save, a clear or an undo starts; the function it returns (if
   * any) is called once that edit has succeeded (rule 11's notice,
   * `useWeekRecalculation`).
   */
  onEditStart?: () => (() => void) | undefined;
}

/**
 * The week view's day table (docs/features/hours-tracker.md → UI → Week view):
 * seven rows, each a small form, with live figures from `@repo/domain`
 * computed in the browser from the saved days plus any readable unsaved row,
 * and a totals row. Mount it with `key={weekStart}`, so a new week starts with
 * no unsaved rows.
 *
 * While any row is unsaved, leaving (another week, another page, a reload or
 * closing the tab) asks first: "Discard changes?" (docs/UX_STANDARDS.md →
 * Forms).
 */
export function WeekTable({
  weekStart,
  today,
  terms,
  savedDays,
  converting,
  publicHolidays,
  labelledBy,
  focusDate,
  onFocusDone,
  onReload,
  onCalculated,
  onEditStart,
}: WeekTableProps) {
  const [drafts, setDrafts] = React.useState<Readonly<Record<IsoDate, Draft>>>({});
  const [saving, setSaving] = React.useState<ReadonlySet<IsoDate>>(new Set());
  const focusAfterMenu = React.useRef<IsoDate | null>(null);
  const create = useCreateWorkDay();
  const update = useUpdateWorkDay();
  const remove = useDeleteWorkDay();
  const restore = useRestoreWorkDay();

  const dates = React.useMemo(() => weekDates(weekStart), [weekStart]);
  const savedByDate = React.useMemo(
    () => new Map(savedDays.map((day) => [day.date, day])),
    [savedDays],
  );

  const textOf = (date: IsoDate): RowText =>
    drafts[date]?.text ?? textFromSaved(savedByDate.get(date));
  const isDirty = (date: IsoDate): boolean => {
    const draft = drafts[date];
    return draft !== undefined && !sameRow(draft.text, textFromSaved(savedByDate.get(date)));
  };
  const unsaved = dates.filter(isDirty);

  // Live figures: the saved days, with each readable unsaved row in place of
  // its saved one. The first run happens as the week's data arrives, not on
  // a keypress (slice 3's performance note).
  const calculation = React.useMemo(() => {
    const rows: WorkDayRow[] = [];
    for (const date of dates) {
      const saved = savedByDate.get(date);
      const draft = drafts[date];
      const parsed = draft ? parseRow(date, draft.text) : null;
      if (parsed?.ok) rows.push({ date, ...parsed.payload });
      else if (saved) rows.push(toEngineDay(saved));
    }
    return calculateWeek({
      weekStart,
      terms,
      days: rows,
      converting,
      publicHolidays,
      asOf: today,
    });
  }, [dates, savedByDate, drafts, weekStart, terms, converting, publicHolidays, today]);

  React.useEffect(() => {
    onCalculated?.(calculation);
  }, [calculation, onCalculated]);

  // Block leaving with unsaved rows; the dialog below resolves it.
  const hasUnsaved = unsaved.length > 0;
  const blocker = useBlocker({
    shouldBlockFn: () => hasUnsaved,
    enableBeforeUnload: hasUnsaved,
    withResolver: true,
  });

  React.useEffect(() => {
    if (!focusDate || !calculation) return;
    document.getElementById(fieldId('start', focusDate))?.focus();
    onFocusDone();
  }, [focusDate, calculation, onFocusDone]);

  const setDraft = React.useCallback(
    (date: IsoDate, change: (draft: Draft) => Draft) =>
      setDrafts((current) => {
        const base: Draft = current[date] ?? {
          text: textFromSaved(savedByDate.get(date)),
          touched: new Set(),
        };
        return { ...current, [date]: change(base) };
      }),
    [savedByDate],
  );

  const dropDraft = React.useCallback(
    (date: IsoDate) =>
      setDrafts((current) => {
        const { [date]: _dropped, ...rest } = current;
        return rest;
      }),
    [],
  );

  const setSavingFor = (date: IsoDate, on: boolean) =>
    setSaving((current) => {
      const next = new Set(current);
      if (on) next.add(date);
      else next.delete(date);
      return next;
    });

  const labelOf = (date: IsoDate) => formatDate(date, 'weekdayDayMonth');

  const save = (date: IsoDate) => {
    const draft = drafts[date];
    if (!draft || !isDirty(date) || saving.has(date)) return;
    const parsed = parseRow(date, draft.text);
    if (!parsed.ok) {
      setDraft(date, (current) => ({ ...current, touched: new Set(ROW_FIELDS) }));
      const first = ROW_FIELDS.find((field) => parsed.errors[field]);
      if (first) document.getElementById(fieldId(first, date))?.focus();
      return;
    }
    const label = labelOf(date);
    const saved = savedByDate.get(date);
    const edited = onEditStart?.();
    const callbacks = {
      onSuccess: () => {
        dropDraft(date);
        toast({ title: `${label} saved` });
        edited?.();
      },
      onError: (error: Error) => {
        if (error instanceof ApiRequestError && error.status === 422) {
          const reasons = refusalReasons(error);
          setDraft(date, (current) => ({ ...current, saveErrors: reasons }));
          return;
        }
        toastSaveError(`We couldn't save ${label}`, error, () => {
          dropDraft(date);
          onReload();
        });
      },
      onSettled: () => setSavingFor(date, false),
    };
    setSavingFor(date, true);
    setDraft(date, (current) => ({ ...current, saveErrors: undefined }));
    if (saved) {
      update.mutate(
        { id: saved.id, body: { ...parsed.payload, version: saved.version } },
        callbacks,
      );
    } else {
      create.mutate({ date, ...parsed.payload }, callbacks);
    }
  };

  /** The row after `date` (or before, for the last), whose Start takes focus after a clear. */
  const neighbourOf = (date: IsoDate): IsoDate => {
    const index = dates.indexOf(date);
    return dates[index + 1] ?? dates[index - 1] ?? date;
  };

  const clear = (date: IsoDate) => {
    const saved = savedByDate.get(date);
    const label = labelOf(date);
    focusAfterMenu.current = neighbourOf(date);
    dropDraft(date);
    if (!saved) return;
    const cleared = onEditStart?.();
    const undo = () => {
      const restored = onEditStart?.();
      restore.mutate(saved.id, {
        onSuccess: () => {
          toast({ title: `${label} restored` });
          restored?.();
        },
        onError: (error) =>
          toast({
            variant: 'error',
            title: `We couldn't restore ${label}`,
            description: actionErrorMessage(error, 'Try again in a moment.'),
          }),
      });
    };
    remove.mutate(saved.id, {
      onSuccess: () => {
        toast({
          title: 'Day cleared',
          description: label,
          action: { label: 'Undo', altText: `Undo clearing ${label}`, onAction: undo },
        });
        cleared?.();
      },
      onError: (error) =>
        toast({
          variant: 'error',
          title: `We couldn't clear ${label}`,
          description: actionErrorMessage(error, 'Try again in a moment.'),
        }),
    });
  };

  const takeFocusAfterMenu = React.useCallback((): HTMLElement | null => {
    const date = focusAfterMenu.current;
    focusAfterMenu.current = null;
    return date ? document.getElementById(fieldId('start', date)) : null;
  }, []);

  // The rows' handlers: the same functions on every render, so a keystroke
  // re-renders only its own row (`DayRow` is memoised).
  const onFieldChange = React.useCallback(
    (date: IsoDate, field: RowField, value: string) =>
      setDraft(date, (current) => ({ ...current, text: { ...current.text, [field]: value } })),
    [setDraft],
  );
  const onFieldBlur = React.useCallback(
    (date: IsoDate, field: RowField) =>
      // Only a changed row validates: passing through an untouched row's
      // fields with Tab flags nothing.
      setDrafts((current) => {
        const draft = current[date];
        if (!draft || draft.touched.has(field)) return current;
        if (sameRow(draft.text, textFromSaved(savedByDate.get(date)))) return current;
        return { ...current, [date]: { ...draft, touched: new Set([...draft.touched, field]) } };
      }),
    [savedByDate],
  );
  const onToggleBankHolidayWorked = React.useCallback(
    (date: IsoDate) =>
      setDraft(date, (current) => ({
        ...current,
        text: { ...current.text, bankHolidayWorked: !current.text.bankHolidayWorked },
      })),
    [setDraft],
  );
  const onSave = useStableHandler(save);
  const onClear = useStableHandler(clear);

  if (!calculation) return null;
  const { days, week, terms: weekTerms } = calculation;
  const showConverted = week.conversion !== 'OFF';
  const columns = columnCount(showConverted);
  const totals = weekTotals(days);
  const convertedTotal =
    week.conversion === 'APPLIED' ? totals.convertedMinutes : totals.previewConvertedMinutes;

  return (
    <>
      <TableContainer>
        <Table aria-labelledby={labelledBy} className="text-small">
          <WeekTableHead converting={showConverted} preview={week.conversion === 'PREVIEW'} />
          <TableBody>
            {dates.map((date, index) => {
              const day = days[index]!;
              const draft = drafts[date];
              const text = textOf(date);
              const dirty = isDirty(date);
              const parsed = dirty ? parseRow(date, text) : null;
              const fieldErrors: Partial<Record<RowField, string>> = {};
              if (parsed && !parsed.ok && draft) {
                for (const field of ROW_FIELDS) {
                  const error = parsed.errors[field];
                  if (error && draft.touched.has(field)) fieldErrors[field] = error;
                }
              }
              const engineRow = parsed?.ok
                ? { date, ...parsed.payload }
                : savedByDate.has(date)
                  ? toEngineDay(savedByDate.get(date)!)
                  : undefined;
              return (
                <DayRow
                  key={date}
                  date={date}
                  label={labelOf(date)}
                  isToday={date === today}
                  striped={index % 2 === 1}
                  text={text}
                  dirty={dirty}
                  hasSaved={savedByDate.has(date)}
                  day={dayFigures(day)}
                  warnings={rowWarnings(day, weekTerms, engineRow)}
                  conversion={week.conversion}
                  fieldErrors={fieldErrors}
                  saveErrors={dirty ? draft?.saveErrors : undefined}
                  saving={saving.has(date)}
                  columns={columns}
                  onFieldChange={onFieldChange}
                  onFieldBlur={onFieldBlur}
                  onSave={onSave}
                  onRevert={dropDraft}
                  onClear={onClear}
                  onToggleBankHolidayWorked={onToggleBankHolidayWorked}
                  focusAfterMenu={takeFocusAfterMenu}
                />
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow hover={false}>
              <TableRowHeader className="pr-2 align-top first:pl-3">Week</TableRowHeader>
              <TableCell colSpan={5} />
              <TableCell numeric className="px-1 align-top">
                {formatDuration(days.reduce((sum, day) => sum + day.workedMinutes, 0))}
              </TableCell>
              <TableCell numeric className="px-1 align-top">
                {formatDuration(totals.creditedMinutes)}
                {/* "of 37:30" on its own short line; "target" is read, not shown, so the
                    column stays narrow (the aside shows the target in words). */}
                <span className="text-muted-foreground text-meta block font-normal">
                  <span className="sr-only"> </span>of {formatDuration(totals.targetMinutes)}
                  <span className="sr-only"> target</span>
                </span>
              </TableCell>
              <TableCell numeric className="px-1 align-top">
                <FlexiValue minutes={totals.flexiMinutes} />
              </TableCell>
              {showConverted ? (
                <TableCell numeric className="px-1 align-top">
                  {formatDuration(convertedTotal)}
                </TableCell>
              ) : null}
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>
      <AlertDialog
        open={blocker.status === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            {unsaved.length === 1
              ? `${labelOf(unsaved[0]!)} has changes you haven't saved.`
              : `${String(unsaved.length)} days have changes you haven't saved.`}{' '}
            If you leave, they will be lost.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
