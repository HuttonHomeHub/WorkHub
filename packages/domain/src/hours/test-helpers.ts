import { type IsoDate, shiftInstants } from '../core/time/index.js';

import { defaultWorkTerms } from './defaults.js';
import { parseTimeOfDay } from './format.js';
import type { HoursInput, WorkDayRow, WorkTerms } from './types.js';

/** A day row from London wall-clock times (`'08:00'`, `'17:30'`); test-only. */
export function day(
  date: IsoDate,
  start: string | null,
  end: string | null,
  extra: Partial<Omit<WorkDayRow, 'date' | 'startsAt' | 'endsAt'>> = {},
): WorkDayRow {
  let times: Pick<WorkDayRow, 'startsAt' | 'endsAt'> = { startsAt: null, endsAt: null };
  if (start !== null && end !== null) {
    const { startsAt, endsAt } = shiftInstants(date, parseTimeOfDay(start)!, parseTimeOfDay(end)!);
    times = { startsAt, endsAt };
  }
  return {
    date,
    ...times,
    breakMinutes: 0,
    leaveMinutes: 0,
    toilTakenMinutes: 0,
    bankHolidayWorked: false,
    ...extra,
  };
}

/** Input with the default terms from `trackingStart`, overridable per field. */
export function input(
  trackingStart: IsoDate,
  asOf: IsoDate,
  overrides: Partial<HoursInput> = {},
  terms: Partial<WorkTerms> = {},
): HoursInput {
  return {
    terms: [{ ...defaultWorkTerms(trackingStart), ...terms }],
    days: [],
    conversions: [],
    publicHolidays: [],
    adjustments: [],
    leaveYears: [],
    asOf,
    ...overrides,
  };
}

/** `h:mm` → minutes, for readable expectations (`m('7:30')` = 450). */
export function m(text: string): number {
  const negative = text.startsWith('-');
  const [h, mm] = text.replace('-', '').split(':').map(Number);
  const minutes = (h ?? 0) * 60 + (mm ?? 0);
  return negative ? -minutes : minutes;
}
