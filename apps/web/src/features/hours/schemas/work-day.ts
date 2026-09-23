import {
  formatDuration,
  formatTimeOfDay,
  localMinutesOf,
  minutesBetween,
  parseDuration,
  parseTimeOfDay,
  shiftInstants,
  type IsoDate,
  type WorkDayRow,
} from '@repo/domain';
import { MINUTES_PER_DAY } from '@repo/types';
import { z } from 'zod';

/**
 * A week-view row as the owner types it (docs/features/hours-tracker.md → UI,
 * "Rows are small forms"): text for each field, kept exactly as typed until
 * blur tidies it, plus the bank holiday flag the row menu sets.
 */
export interface RowText {
  start: string;
  end: string;
  break: string;
  leave: string;
  toil: string;
  bankHolidayWorked: boolean;
}

export type RowField = 'start' | 'end' | 'break' | 'leave' | 'toil';

export const ROW_FIELDS: readonly RowField[] = ['start', 'end', 'break', 'leave', 'toil'];

export const EMPTY_ROW: RowText = {
  start: '',
  end: '',
  break: '',
  leave: '',
  toil: '',
  bankHolidayWorked: false,
};

/** The saved fields of a day, as the API returns them (a `WorkDayResponseDto`). */
type SavedDay = Pick<
  WorkDayRow,
  'startsAt' | 'endsAt' | 'breakMinutes' | 'leaveMinutes' | 'toilTakenMinutes' | 'bankHolidayWorked'
>;

const minutesText = (minutes: number): string => (minutes === 0 ? '' : formatDuration(minutes));

/** The text a saved day shows: London `HH:MM` times, and durations as `h:mm` (blank for none). */
export function textFromSaved(saved: SavedDay | undefined): RowText {
  if (!saved) return EMPTY_ROW;
  return {
    start: saved.startsAt ? formatTimeOfDay(localMinutesOf(saved.startsAt)) : '',
    end: saved.endsAt ? formatTimeOfDay(localMinutesOf(saved.endsAt)) : '',
    break: minutesText(saved.breakMinutes),
    leave: minutesText(saved.leaveMinutes),
    toil: minutesText(saved.toilTakenMinutes),
    bankHolidayWorked: saved.bankHolidayWorked,
  };
}

/** Whether two rows say the same thing (so an edit typed back to the saved value is not a change). */
export function sameRow(a: RowText, b: RowText): boolean {
  const time = (text: string) => parseTimeOfDay(text) ?? text.trim();
  const duration = (text: string) =>
    text.trim() === '' ? 0 : (parseDuration(text) ?? text.trim());
  return (
    time(a.start) === time(b.start) &&
    time(a.end) === time(b.end) &&
    duration(a.break) === duration(b.break) &&
    duration(a.leave) === duration(b.leave) &&
    duration(a.toil) === duration(b.toil) &&
    a.bankHolidayWorked === b.bankHolidayWorked
  );
}

const time = z.string().transform((text, ctx): number | null => {
  if (text.trim() === '') return null;
  const minutes = parseTimeOfDay(text);
  if (minutes === null) {
    ctx.addIssue({ code: 'custom', message: 'Enter a 24-hour time, such as 08:30.' });
    return z.NEVER;
  }
  return minutes;
});

const duration = z.string().transform((text, ctx): number => {
  if (text.trim() === '') return 0;
  const minutes = parseDuration(text);
  if (minutes === null) {
    ctx.addIssue({ code: 'custom', message: 'Enter hours and minutes, such as 0:30.' });
    return z.NEVER;
  }
  if (minutes > MINUTES_PER_DAY) {
    ctx.addIssue({ code: 'custom', message: `Enter at most ${formatDuration(MINUTES_PER_DAY)}.` });
    return z.NEVER;
  }
  return minutes;
});

/**
 * One row's fields → minutes, with the rules the row can check by itself: a
 * start and an end together, a break only with times, and a break shorter
 * than the day. The API checks the rest (leave limits, working days,
 * neighbouring days) and its 422 `details` are shown under the row.
 */
export const workDayRowSchema = z
  .object({
    start: time,
    end: time,
    break: duration,
    leave: duration,
    toil: duration,
    bankHolidayWorked: z.boolean(),
  })
  .superRefine((row, ctx) => {
    if (row.start !== null && row.end === null) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'Enter an end time too.' });
    }
    if (row.start === null && row.end !== null) {
      ctx.addIssue({ code: 'custom', path: ['start'], message: 'Enter a start time too.' });
    }
    if (row.break > 0 && (row.start === null || row.end === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['break'],
        message: 'Enter a start and end time for a break.',
      });
    }
  });

/** A row ready to send: the API's body fields (instants in UTC with `Z`). */
export interface RowPayload {
  startsAt: string | null;
  endsAt: string | null;
  breakMinutes: number;
  leaveMinutes: number;
  toilTakenMinutes: number;
  bankHolidayWorked: boolean;
}

export type RowParse =
  | { ok: true; payload: RowPayload; overnight: boolean }
  | { ok: false; errors: Partial<Record<RowField, string>> };

/**
 * Reads a row for `date`. Times become instants with `shiftInstants`, so an end
 * at or before the start is the next morning (a night shift), and clock
 * changes are handled by the zone rules.
 */
export function parseRow(date: IsoDate, text: RowText): RowParse {
  const result = workDayRowSchema.safeParse(text);
  if (!result.success) {
    const errors: Partial<Record<RowField, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as RowField | undefined;
      if (field && errors[field] === undefined) errors[field] = issue.message;
    }
    return { ok: false, errors };
  }
  const row = result.data;
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  let overnight = false;
  if (row.start !== null && row.end !== null) {
    const instants = shiftInstants(date, row.start, row.end);
    ({ startsAt, endsAt, overnight } = instants);
    if (row.break >= minutesBetween(startsAt, endsAt)) {
      return { ok: false, errors: { break: 'Enter a break shorter than the day.' } };
    }
  }
  return {
    ok: true,
    overnight,
    payload: {
      startsAt,
      endsAt,
      breakMinutes: row.break,
      leaveMinutes: row.leave,
      toilTakenMinutes: row.toil,
      bankHolidayWorked: row.bankHolidayWorked,
    },
  };
}

/** Whether the typed times run past midnight (an end at or before the start), for the "+1 day" tag. */
export function endsNextDay(text: Pick<RowText, 'start' | 'end'>): boolean {
  const start = parseTimeOfDay(text.start);
  const end = parseTimeOfDay(text.end);
  return start !== null && end !== null && end <= start;
}
