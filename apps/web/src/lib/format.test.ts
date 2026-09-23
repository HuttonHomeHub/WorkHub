import { describe, expect, it } from 'vitest';

import { formatDate } from './format';

describe('formatDate', () => {
  it('formats a calendar date in en-GB without a comma', () => {
    expect(formatDate('2026-10-05')).toBe('Mon 5 Oct 2026');
    expect(formatDate('2026-10-05', 'long')).toBe('Monday 5 October 2026');
    expect(formatDate('2026-10-05', 'weekdayDayMonth')).toBe('Mon 5 Oct');
    expect(formatDate('2026-10-05', 'medium')).toBe('5 Oct 2026');
  });

  it('formats the short styles the hours views use', () => {
    expect(formatDate('2026-10-09', 'weekdayDayMonth')).toBe('Fri 9 Oct');
    expect(formatDate('2026-09-28', 'dayMonth')).toBe('28 Sep');
    expect(formatDate('2026-10-01', 'monthYear')).toBe('October 2026');
    expect(formatDate('2026-09-01', 'month')).toBe('September');
    expect(formatDate('2026-09-28')).toBe('Mon 28 Sep 2026');
  });

  it('never shifts the day across the BST change', () => {
    expect(formatDate('2026-03-29')).toBe('Sun 29 Mar 2026');
    expect(formatDate('2026-10-25')).toBe('Sun 25 Oct 2026');
  });

  it('returns anything that is not a date unchanged', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
