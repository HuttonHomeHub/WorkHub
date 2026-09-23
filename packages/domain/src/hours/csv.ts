import type { CsvCell } from '../core/csv.js';
import { localDateOf, localMinutesOf } from '../core/time/index.js';

import { decimalHours, formatDuration, formatTimeOfDay } from './format.js';
import type { DayResult, HoursResult, WorkDayRow } from './types.js';

/** The day export's columns (docs/features/hours-tracker.md → Export). */
export const DAYS_CSV_HEADER: readonly string[] = [
  'Date',
  'Start',
  'End',
  'Ends next day',
  'Break recorded (h:mm)',
  'Break deducted (h:mm)',
  'Worked (h:mm)',
  'Worked (hours)',
  'Leave (h:mm)',
  'Leave (hours)',
  'TOIL taken (h:mm)',
  'TOIL taken (hours)',
  'Bank holiday (h:mm)',
  'Credited (h:mm)',
  'Credited (hours)',
  'Flexi (h:mm)',
  'Flexi (hours)',
  'Converted (h:mm)',
  'Converted (hours)',
];

/**
 * One CSV row per tracked day in `[from, to)`: the owner's times as London
 * wall-clock `HH:MM`, and every duration in `h:mm` and decimal hours. Days
 * with no row and nothing credited are left out, so the file lists what was
 * recorded or credited.
 */
export function daysCsvRows(
  result: HoursResult,
  rows: readonly WorkDayRow[],
  from: string,
  to: string,
): CsvCell[][] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const out: CsvCell[][] = [[...DAYS_CSV_HEADER]];
  for (const day of result.days) {
    if (day.date < from || day.date >= to) continue;
    if (!day.hasRow && day.creditedMinutes === 0) continue;
    out.push(dayRow(day, byDate.get(day.date)));
  }
  return out;
}

function dayRow(day: DayResult, row: WorkDayRow | undefined): CsvCell[] {
  const start = row?.startsAt ? formatTimeOfDay(localMinutesOf(row.startsAt)) : null;
  const end = row?.endsAt ? formatTimeOfDay(localMinutesOf(row.endsAt)) : null;
  const nextDay = row?.endsAt ? (localDateOf(row.endsAt) > day.date ? 'Yes' : 'No') : null;
  const both = (minutes: number): CsvCell[] => [formatDuration(minutes), decimalHours(minutes)];
  return [
    day.date,
    start,
    end,
    nextDay,
    formatDuration(day.breakRecordedMinutes),
    formatDuration(day.breakDeductedMinutes),
    ...both(day.workedMinutes),
    ...both(day.leaveMinutes),
    ...both(day.toilTakenMinutes),
    formatDuration(day.bankHolidayMinutes),
    ...both(day.creditedMinutes),
    ...both(day.dayFlexiMinutes),
    ...both(day.convertedMinutes),
  ];
}
