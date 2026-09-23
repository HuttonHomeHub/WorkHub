import { describe, expect, it } from 'vitest';

import { dbTimeMinutes, fromDbDate, fromDbTime, toDbDate, toDbTime } from './dates';

describe('date and time column conversions', () => {
  it('round-trips dates at UTC midnight', () => {
    expect(toDbDate('2026-03-29').toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(fromDbDate(toDbDate('2026-10-25'))).toBe('2026-10-25');
  });

  it('round-trips wall-clock times on 1970-01-01 UTC, with no zone shift', () => {
    expect(toDbTime('07:00').toISOString()).toBe('1970-01-01T07:00:00.000Z');
    expect(fromDbTime(toDbTime('19:00'))).toBe('19:00');
    expect(dbTimeMinutes(toDbTime('07:30'))).toBe(450);
  });
});
