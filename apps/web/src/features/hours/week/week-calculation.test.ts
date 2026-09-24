import {
  calculateHours,
  defaultWorkTerms,
  parseTimeOfDay,
  shiftInstants,
  type DayResult,
  type WorkDayRow,
  type WorkTerms,
} from '@repo/domain';
import { describe, expect, it } from 'vitest';

import type { WorkTerm } from '../api/keys';

import { calculateWeek, rowWarnings, toEngineTerms, weekTotals } from './week-calculation';

/** A day from London wall-clock times. */
function day(
  date: string,
  start: string | null,
  end: string | null,
  extra: Partial<WorkDayRow> = {},
): WorkDayRow {
  const times =
    start && end
      ? shiftInstants(date, parseTimeOfDay(start)!, parseTimeOfDay(end)!)
      : { startsAt: null, endsAt: null };
  return {
    date,
    startsAt: times.startsAt,
    endsAt: times.endsAt,
    breakMinutes: 0,
    leaveMinutes: 0,
    toilTakenMinutes: 0,
    bankHolidayWorked: false,
    ...extra,
  };
}

const TERMS = defaultWorkTerms('2026-09-07');

/** The feature doc's worked example: week of Monday 5 October 2026. */
const WORKED_EXAMPLE = [
  day('2026-10-05', '08:00', '17:30', { breakMinutes: 30 }),
  day('2026-10-06', '07:30', '18:00', { breakMinutes: 30 }),
  day('2026-10-07', '08:00', '16:00', { breakMinutes: 30 }),
  day('2026-10-08', '08:00', '17:00', { breakMinutes: 15 }),
  day('2026-10-09', '08:00', '13:30'),
];

/** The fields the table shows, all week-local. */
function shown(days: readonly DayResult[]) {
  return days.map((d) => ({
    date: d.date,
    counted: d.counted,
    worked: d.workedMinutes,
    credited: d.creditedMinutes,
    flexi: d.dayFlexiMinutes,
    converted: d.convertedMinutes,
    preview: d.previewConvertedMinutes,
    bankHoliday: d.bankHolidayMinutes,
    warnings: d.warnings
      .map((w) => w.code)
      .filter((code) => !['TOIL_UNUSED', 'TOIL_NOT_EARNED'].includes(code)),
  }));
}

describe('calculateWeek', () => {
  it('matches a run from the tracking start for every figure the table shows', () => {
    // Earlier weeks, with gaps and a conversion, change balances but not this week.
    const history = [day('2026-09-08', '08:00', '18:00'), day('2026-09-15', '07:00', '19:00')];
    const days = [...history, ...WORKED_EXAMPLE];
    const full = calculateHours(
      {
        terms: [TERMS],
        days,
        conversions: ['2026-09-07', '2026-10-05'],
        publicHolidays: ['2026-08-31', '2026-12-25'],
        adjustments: [{ effectiveDate: '2026-09-07', balance: 'FLEXI', minutes: 600 }],
        leaveYears: [],
        asOf: '2026-10-12',
      },
      { until: '2026-10-11' },
    );
    const week = calculateWeek({
      weekStart: '2026-10-05',
      terms: [TERMS],
      days,
      converting: true,
      publicHolidays: ['2026-08-31', '2026-12-25'],
      asOf: '2026-10-12',
    });
    const expected = full.days.filter((d) => d.date >= '2026-10-05' && d.date < '2026-10-12');
    expect(week).not.toBeNull();
    expect(shown(week!.days)).toEqual(shown(expected));
    expect(week!.week.excessMinutes).toBe(180);
    expect(week!.week.conversion).toBe('APPLIED');
  });

  it('works the worked example: flexi day by day, and levelling with the switch on', () => {
    const off = calculateWeek({
      weekStart: '2026-10-05',
      terms: [TERMS],
      days: WORKED_EXAMPLE,
      converting: false,
      publicHolidays: [],
      asOf: '2026-10-12',
    })!;
    expect(off.days.map((d) => d.dayFlexiMinutes)).toEqual([90, 150, 0, 60, -120, 0, 0]);
    expect(weekTotals(off.days)).toMatchObject({
      creditedMinutes: 2430,
      targetMinutes: 2250,
      flexiMinutes: 180,
    });

    const on = calculateWeek({
      weekStart: '2026-10-05',
      terms: [TERMS],
      days: WORKED_EXAMPLE,
      converting: true,
      publicHolidays: [],
      asOf: '2026-10-12',
    })!;
    // Levelled in 0:30 blocks (rule 6): Mon 0:30, Tue 2:00, Thu 0:30.
    expect(on.days.map((d) => d.convertedMinutes)).toEqual([30, 120, 0, 30, 0, 0, 0]);
    expect(weekTotals(on.days).flexiMinutes).toBe(0);

    // Before the settlement day (Friday), the conversion is a preview only.
    const preview = calculateWeek({
      weekStart: '2026-10-05',
      terms: [TERMS],
      days: WORKED_EXAMPLE.slice(0, 4),
      converting: true,
      publicHolidays: [],
      asOf: '2026-10-08',
    })!;
    expect(preview.week.conversion).toBe('PREVIEW');
    expect(weekTotals(preview.days).convertedMinutes).toBe(0);
    expect(weekTotals(preview.days).previewConvertedMinutes).toBeGreaterThan(0);
  });

  it('uses the terms in force for the week', () => {
    const later = {
      ...TERMS,
      effectiveFrom: '2026-10-12',
      targetMinutes: { ...TERMS.targetMinutes, fri: 330 },
    };
    const week = calculateWeek({
      weekStart: '2026-10-12',
      terms: [later, TERMS],
      days: [],
      converting: false,
      publicHolidays: [],
      asOf: '2026-10-19',
    })!;
    expect(week.days[4]?.targetMinutes).toBe(330);
    expect(week.terms.effectiveFrom).toBe('2026-10-12');
  });

  it('is null before the tracking start or without terms', () => {
    const args = { days: [], converting: false, publicHolidays: [], asOf: '2026-10-12' };
    expect(calculateWeek({ ...args, weekStart: '2026-08-31', terms: [TERMS] })).toBeNull();
    expect(calculateWeek({ ...args, weekStart: '2026-10-05', terms: [] })).toBeNull();
  });
});

describe('rowWarnings', () => {
  const warningsFor = (row: WorkDayRow, terms: WorkTerms = TERMS, holidays: string[] = []) => {
    const week = calculateWeek({
      weekStart: '2026-10-05',
      terms: [terms],
      days: [row],
      converting: false,
      publicHolidays: holidays,
      asOf: '2026-10-12',
    })!;
    const result = week.days.find((d) => d.date === row.date)!;
    return rowWarnings(result, week.terms, row).map((w) => `${w.kind}: ${w.text}`);
  };

  it('says which minimum a short day is below', () => {
    expect(warningsFor(day('2026-10-09', '08:00', '13:00'))).toEqual([
      'warning: Below 5:30 minimum',
    ]);
    expect(warningsFor(day('2026-10-09', '08:00', '13:30'))).toEqual([]);
  });

  it('says which edge of the working band a day crosses', () => {
    expect(warningsFor(day('2026-10-05', '06:30', '15:00', { breakMinutes: 30 }))).toEqual([
      'warning: Before 07:00',
    ]);
    expect(warningsFor(day('2026-10-05', '10:30', '19:30', { breakMinutes: 30 }))).toEqual([
      'warning: After 19:00',
    ]);
    // A night shift ends after the band, on the next day.
    expect(warningsFor(day('2026-10-07', '22:00', '06:00'))).toEqual([
      'note: Break raised to 0:30',
      'warning: After 19:00',
    ]);
  });

  it('notes a raised break and flags a missing past working day', () => {
    expect(warningsFor(day('2026-10-05', '08:00', '16:30'))).toEqual([
      'note: Break raised to 0:30',
    ]);
    const week = calculateWeek({
      weekStart: '2026-10-05',
      terms: [TERMS],
      days: [],
      converting: false,
      publicHolidays: [],
      asOf: '2026-10-12',
    })!;
    expect(rowWarnings(week.days[0]!, TERMS, undefined)).toEqual([
      { kind: 'warning', text: 'Nothing recorded' },
    ]);
  });
});

describe('toEngineTerms', () => {
  it('turns the band into minutes after midnight', () => {
    const row: WorkTerm = {
      id: 't1',
      ownerId: 'o1',
      effectiveFrom: '2026-09-07',
      targetMinutes: TERMS.targetMinutes,
      minimumMinutes: TERMS.minimumMinutes,
      breakThresholdMinutes: 360,
      breakMinimumMinutes: 30,
      bandStart: '07:30',
      bandEnd: '18:45',
      paidOvertimeAllowed: false,
      toilMonthlyCapMinutes: 450,
      conversionBlockMinutes: 30,
      leaveDayMaxMinutes: 450,
      flexiCreditCapMinutes: null,
      flexiDebitCapMinutes: 600,
      version: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    };
    expect(toEngineTerms(row)).toEqual({
      ...TERMS,
      bandStartMinutes: 450,
      bandEndMinutes: 1125,
      flexiDebitCapMinutes: 600,
    });
  });
});
