import { describe, expect, it } from 'vitest';

import {
  computedHolidays,
  englandAndWalesHolidays,
  IMPORT_FIRST_YEAR,
  IMPORT_LAST_YEAR,
  OFFICIAL_LAST_YEAR,
} from './england-and-wales';

/** Years with a one-off holiday or a moved one, where the rules alone differ. */
const SPECIAL_YEARS = new Set([2020, 2022, 2023]);

describe('England and Wales bank holidays', () => {
  it('has eight a year outside the special years', () => {
    for (let year = IMPORT_FIRST_YEAR; year <= IMPORT_LAST_YEAR; year++) {
      if (!SPECIAL_YEARS.has(year)) expect(englandAndWalesHolidays(year)).toHaveLength(8);
    }
  });

  it('computes exactly the official dates for every ordinary published year', () => {
    for (let year = IMPORT_FIRST_YEAR; year <= OFFICIAL_LAST_YEAR; year++) {
      if (SPECIAL_YEARS.has(year)) continue;
      expect(computedHolidays(year).map((h) => h.date)).toEqual(
        englandAndWalesHolidays(year).map((h) => h.date),
      );
    }
  });

  it('keeps the official one-off holidays', () => {
    const dates = englandAndWalesHolidays(2022).map((h) => h.date);
    expect(dates).toContain('2022-06-03'); // Platinum Jubilee
    expect(dates).toContain('2022-09-19'); // State funeral
    expect(englandAndWalesHolidays(2023).map((h) => h.date)).toContain('2023-05-08');
  });

  it('substitutes weekend Christmas and New Year dates', () => {
    // 2032: Christmas Saturday, Boxing Day Sunday → Monday 27 and Tuesday 28.
    expect(
      computedHolidays(2032)
        .slice(-2)
        .map((h) => h.date),
    ).toEqual(['2032-12-27', '2032-12-28']);
    // 2033: New Year's Day Saturday → Monday 3 January. Christmas Sunday: Boxing
    // Day keeps Monday 26 and Christmas moves to Tuesday 27 (as GOV.UK lists 2022).
    expect(computedHolidays(2033)[0]!.date).toBe('2033-01-03');
    expect(computedHolidays(2033).slice(-2)).toEqual([
      { date: '2033-12-26', name: 'Boxing Day' },
      { date: '2033-12-27', name: 'Christmas Day' },
    ]);
    // The same rule reproduces 2022's official Christmas dates.
    expect(
      computedHolidays(2022)
        .slice(-2)
        .map((h) => h.date),
    ).toEqual(
      englandAndWalesHolidays(2022)
        .slice(-2)
        .map((h) => h.date),
    );
  });

  it('refuses years outside the bundle', () => {
    expect(() => englandAndWalesHolidays(IMPORT_LAST_YEAR + 1)).toThrow(RangeError);
    expect(() => englandAndWalesHolidays(IMPORT_FIRST_YEAR - 1)).toThrow(RangeError);
  });
});
