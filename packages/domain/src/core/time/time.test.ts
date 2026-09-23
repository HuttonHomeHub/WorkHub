import { describe, expect, it } from 'vitest';

import {
  addDays,
  datesInRange,
  dayOfWeek,
  isIsoDate,
  lastDayOfMonth,
  localDateOf,
  localMinutesOf,
  londonDateAt,
  londonInstant,
  minutesBetween,
  shiftInstants,
  weekStartOf,
} from './index.js';

describe('Europe/London time helpers', () => {
  it('works in ISO weeks, Monday first', () => {
    expect(dayOfWeek('2026-10-05')).toBe(1);
    expect(dayOfWeek('2026-10-11')).toBe(7);
    expect(weekStartOf('2026-10-11')).toBe('2026-10-05');
    expect(weekStartOf('2026-10-01')).toBe('2026-09-28');
  });

  it('handles month and year edges', () => {
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(datesInRange('2026-09-29', '2026-10-02')).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
    ]);
  });

  it('validates dates strictly', () => {
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-2-01')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });

  it('converts wall-clock times in BST and GMT', () => {
    expect(londonInstant('2026-07-01', 8 * 60)).toBe('2026-07-01T07:00:00Z');
    expect(londonInstant('2026-12-01', 8 * 60)).toBe('2026-12-01T08:00:00Z');
    expect(localDateOf('2026-07-01T23:30:00Z')).toBe('2026-07-02');
    expect(localMinutesOf('2026-07-01T07:00:00Z')).toBe(8 * 60);
    expect(londonDateAt(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29');
  });

  it('resolves a skipped spring time forward', () => {
    // 01:30 on 29 March 2026 does not exist in London; it becomes 02:30 BST.
    expect(londonInstant('2026-03-29', 90)).toBe('2026-03-29T01:30:00Z');
  });

  it('builds overnight shifts and measures elapsed minutes on instants', () => {
    const spring = shiftInstants('2026-03-28', 22 * 60, 6 * 60);
    expect(spring.overnight).toBe(true);
    expect(minutesBetween(spring.startsAt, spring.endsAt)).toBe(7 * 60);
    const autumn = shiftInstants('2026-10-24', 22 * 60, 6 * 60);
    expect(minutesBetween(autumn.startsAt, autumn.endsAt)).toBe(9 * 60);
  });

  it('rejects out-of-range times of day', () => {
    expect(() => londonInstant('2026-10-05', 1440)).toThrow(RangeError);
  });
});
