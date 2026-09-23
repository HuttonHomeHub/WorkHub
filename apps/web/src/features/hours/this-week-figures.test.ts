import {
  calculateHours,
  defaultWorkTerms,
  parseTimeOfDay,
  shiftInstants,
  summarise,
  type WorkDayRow,
} from '@repo/domain';
import { describe, expect, it } from 'vitest';

import { liveWeekFigures } from './this-week-figures';

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

describe('liveWeekFigures', () => {
  it("gives the week's week-local figures from an engine run, as the summary group does", () => {
    const result = run('2026-10-12', ['2026-10-05']);
    const figures = liveWeekFigures(result, '2026-10-05');
    expect(figures).toEqual({
      targetMinutes: 2250,
      creditedMinutes: 2430,
      rawFlexiMinutes: 180,
      excessMinutes: 180,
    });
    // The same totals `time-summaries` builds with `summarise`.
    const [group] = summarise(result, '2026-10-05', '2026-10-12', 'week');
    expect(figures?.creditedMinutes).toBe(group?.creditedMinutes);
    expect(figures?.rawFlexiMinutes).toBe(group?.rawFlexiMinutes);
  });

  it('leaves out the TOIL and overtime split, which a one-week run gets wrong', () => {
    // Alone, the week's 3:00 would all be TOIL; with 6:30 converted earlier in
    // October (the worked example) it is 1:00 TOIL and 2:00 overtime.
    const figures = liveWeekFigures(run('2026-10-12', ['2026-10-05']), '2026-10-05');
    expect(figures).not.toHaveProperty('toilMinutes');
    expect(figures).not.toHaveProperty('overtimeUnpaidMinutes');
  });

  it('is null for a week the result does not cover', () => {
    expect(liveWeekFigures(run('2026-10-12', []), '2030-01-07')).toBeNull();
  });
});
