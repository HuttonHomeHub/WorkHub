import type { WorkTerm } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { toDbDate, toDbTime } from '../../../common/dates';

import { type WorkDayValues, workDayProblems } from './work-day-rules';

const terms = {
  effectiveFrom: toDbDate('2026-10-05'),
  targetMinutesMon: 450,
  targetMinutesTue: 450,
  targetMinutesWed: 450,
  targetMinutesThu: 450,
  targetMinutesFri: 450,
  targetMinutesSat: null,
  targetMinutesSun: null,
  leaveDayMaxMinutes: 450,
  bandStart: toDbTime('07:00'),
  bandEnd: toDbTime('19:00'),
} as WorkTerm;

const day = (overrides: Partial<WorkDayValues> = {}): WorkDayValues => ({
  date: '2026-10-05',
  startsAt: '2026-10-05T07:00:00.000Z', // 08:00 BST
  endsAt: '2026-10-05T15:30:00.000Z',
  breakMinutes: 30,
  leaveMinutes: 0,
  toilTakenMinutes: 0,
  bankHolidayWorked: false,
  ...overrides,
});
const none = { previousEndsAt: null, nextStartsAt: null };

describe('workDayProblems', () => {
  it('accepts an ordinary day, a night shift and a leave day', () => {
    expect(workDayProblems(day(), terms, false, none)).toEqual([]);
    expect(
      workDayProblems(
        day({ startsAt: '2026-10-05T21:00:00.000Z', endsAt: '2026-10-06T05:00:00.000Z' }),
        terms,
        false,
        none,
      ),
    ).toEqual([]);
    expect(
      workDayProblems(
        day({ startsAt: null, endsAt: null, breakMinutes: 0, leaveMinutes: 450 }),
        terms,
        false,
        none,
      ),
    ).toEqual([]);
  });

  it('needs terms in force', () => {
    expect(workDayProblems(day(), null, false, none)[0]).toMatch(/tracking start/);
  });

  it('checks the times', () => {
    const problems = (v: Partial<WorkDayValues>) => workDayProblems(day(v), terms, false, none);
    expect(problems({ endsAt: null })).toContain(
      'startsAt and endsAt must both be set, or both be empty',
    );
    expect(problems({ endsAt: '2026-10-05T07:00:00.000Z' })).toContain(
      'endsAt must be after startsAt',
    );
    expect(problems({ endsAt: '2026-10-06T07:01:00.000Z' })).toContain(
      'a shift must be at most 24 hours',
    );
    expect(problems({ breakMinutes: 510 })).toContain('breakMinutes must be less than the shift');
    expect(problems({ startsAt: null, endsAt: null, breakMinutes: 30 })).toContain(
      'breakMinutes needs a start and end',
    );
    // 23:30 UTC on 4 Oct is 00:30 BST on 5 Oct — it falls on the date.
    expect(problems({ startsAt: '2026-10-04T23:30:00.000Z' })).toEqual([]);
    expect(problems({ startsAt: '2026-10-04T22:30:00.000Z' })).toContain(
      'startsAt must fall on date in Europe/London',
    );
  });

  it('refuses a night shift that runs into the next day or starts before the previous one ends', () => {
    const night = day({ startsAt: '2026-10-05T21:00:00.000Z', endsAt: '2026-10-06T06:00:00.000Z' });
    expect(
      workDayProblems(night, terms, false, {
        previousEndsAt: null,
        nextStartsAt: '2026-10-06T05:30:00.000Z',
      }),
    ).toContain("endsAt must not run into the next day's start");
    expect(
      workDayProblems(day(), terms, false, {
        previousEndsAt: '2026-10-05T07:30:00.000Z',
        nextStartsAt: null,
      }),
    ).toContain("startsAt must not be before the previous day's end");
  });

  it('compares neighbour instants as moments, not strings', () => {
    // Previous day ended 30 seconds after this start: an overlap, though
    // '…05:30Z' sorts after '…05:30:30.000Z' as a string.
    const start = day({ startsAt: '2026-10-05T05:30Z', endsAt: '2026-10-05T13:00Z' });
    expect(
      workDayProblems(start, terms, false, {
        previousEndsAt: '2026-10-05T05:30:30.000Z',
        nextStartsAt: null,
      }),
    ).toContain("startsAt must not be before the previous day's end");
    // Ending exactly when the next day starts is fine.
    const night = day({ startsAt: '2026-10-05T21:00Z', endsAt: '2026-10-06T05:00Z' });
    expect(
      workDayProblems(night, terms, false, {
        previousEndsAt: null,
        nextStartsAt: '2026-10-06T05:00:00.000Z',
      }),
    ).toEqual([]);
  });

  it("applies rule 4's limits", () => {
    const problems = (v: Partial<WorkDayValues>, holiday = false) =>
      workDayProblems(
        day({ startsAt: null, endsAt: null, breakMinutes: 0, ...v }),
        terms,
        holiday,
        none,
      );
    expect(problems({ leaveMinutes: 460 })).toContain(
      'leaveMinutes must be at most 450 (the maximum per day)',
    );
    expect(problems({ leaveMinutes: 300, toilTakenMinutes: 200 })).toContain(
      "leave and TOIL taken together must be at most the day's target (450)",
    );
    expect(problems({ date: '2026-10-10', leaveMinutes: 60 })).toContain(
      'leave and TOIL taken are only allowed on working days',
    );
    expect(problems({ leaveMinutes: 60 }, true)).toContain(
      'leave and TOIL taken cannot be added to a bank holiday unless it was worked',
    );
    expect(problems({ leaveMinutes: 60, bankHolidayWorked: true }, true)).toEqual([]);
    expect(problems({ bankHolidayWorked: true })).toContain(
      'bankHolidayWorked is only for a bank holiday',
    );
  });
});
