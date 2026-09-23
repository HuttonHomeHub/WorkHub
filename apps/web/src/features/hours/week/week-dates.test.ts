import { describe, expect, it } from 'vitest';

import { canMoveWeek, normaliseWeek, weekDates } from './week-dates';

const TODAY = '2026-09-23'; // a Wednesday

describe('normaliseWeek', () => {
  it('keeps a Monday', () => {
    expect(normaliseWeek('2026-10-05', TODAY)).toBe('2026-10-05');
  });

  it("turns any other date into its week's Monday", () => {
    expect(normaliseWeek('2026-10-08', TODAY)).toBe('2026-10-05');
    expect(normaliseWeek('2026-10-11', TODAY)).toBe('2026-10-05');
    // Across a month and a year.
    expect(normaliseWeek('2026-11-01', TODAY)).toBe('2026-10-26');
    expect(normaliseWeek('2027-01-01', TODAY)).toBe('2026-12-28');
  });

  it('falls back to this week when the week is missing, unreadable or out of range', () => {
    for (const week of [
      undefined,
      '',
      'next',
      '2026-02-30',
      '2026-9-7',
      '1999-12-27',
      '2101-01-03',
    ]) {
      expect(normaliseWeek(week, TODAY)).toBe('2026-09-21');
    }
    // 1 January 2000 is a Saturday: its week starts in 1999.
    expect(normaliseWeek('2000-01-01', TODAY)).toBe('2026-09-21');
    expect(normaliseWeek('2000-01-03', TODAY)).toBe('2000-01-03');
  });
});

describe('weekDates and canMoveWeek', () => {
  it('lists the seven days from Monday', () => {
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('stops at the first and last whole weeks of the hours years', () => {
    expect(canMoveWeek('2000-01-03', -1)).toBe(false);
    expect(canMoveWeek('2000-01-03', 1)).toBe(true);
    expect(canMoveWeek('2100-12-20', 1)).toBe(false);
    expect(canMoveWeek('2100-12-20', -1)).toBe(true);
  });
});
