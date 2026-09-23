import {
  calculateHours,
  defaultWorkTerms,
  parseTimeOfDay,
  shiftInstants,
  summarise,
  type WorkDayRow,
} from '@repo/domain';
import { describe, expect, it } from 'vitest';

import { thisWeekFigures } from './this-week-figures';

function day(date: string, start: string, end: string, breakMinutes = 30): WorkDayRow {
  return {
    date,
    ...shiftInstants(date, parseTimeOfDay(start) ?? 0, parseTimeOfDay(end) ?? 0),
    breakMinutes,
    leaveMinutes: 0,
    toilTakenMinutes: 0,
    bankHolidayWorked: false,
  };
}

// The feature doc's worked example, week of Mon 5 Oct 2026.
const days = [
  day('2026-10-05', '08:00', '17:30'),
  day('2026-10-06', '07:30', '18:00'),
  day('2026-10-07', '08:00', '16:00'),
  day('2026-10-08', '08:00', '17:00', 15),
  day('2026-10-09', '08:00', '13:30', 0),
];

function run(asOf: string, conversions: string[]) {
  return calculateHours({
    terms: [defaultWorkTerms('2026-10-05')],
    days,
    conversions,
    publicHolidays: [],
    adjustments: [],
    leaveYears: [],
    asOf,
  });
}

describe('thisWeekFigures', () => {
  it("gives the week's figures from an engine run, as the summary group does", () => {
    const result = run('2026-10-12', ['2026-10-05']);
    const figures = thisWeekFigures(result, '2026-10-05');
    expect(figures).toEqual({
      targetMinutes: 2250,
      creditedMinutes: 2430,
      rawFlexiMinutes: 180,
      conversion: 'APPLIED',
      settlementDate: '2026-10-09',
      excessMinutes: 180,
      toilMinutes: 180,
      overtimePaidMinutes: 0,
      overtimeUnpaidMinutes: 0,
    });
    // The same totals `time-summaries` builds with `summarise`.
    const [group] = summarise(result, '2026-10-05', '2026-10-12', 'week');
    expect(figures?.creditedMinutes).toBe(group?.creditedMinutes);
    expect(figures?.rawFlexiMinutes).toBe(group?.rawFlexiMinutes);
  });

  it('shows a preview before the settlement day, and off without the switch', () => {
    expect(thisWeekFigures(run('2026-10-08', ['2026-10-05']), '2026-10-05')?.conversion).toBe(
      'PREVIEW',
    );
    expect(thisWeekFigures(run('2026-10-12', []), '2026-10-05')?.conversion).toBe('OFF');
  });

  it('is null for a week the result does not cover', () => {
    expect(thisWeekFigures(run('2026-10-12', []), '2030-01-07')).toBeNull();
  });
});
