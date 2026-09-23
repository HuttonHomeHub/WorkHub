import { describe, expect, it } from 'vitest';

import { formatDate } from './format';

describe('formatDate', () => {
  it('formats a calendar date in en-GB without a comma', () => {
    expect(formatDate('2026-10-05')).toBe('Mon 5 Oct 2026');
    expect(formatDate('2026-10-05', 'long')).toBe('Monday 5 October 2026');
  });

  it('never shifts the day across the BST change', () => {
    expect(formatDate('2026-03-29')).toBe('Sun 29 Mar 2026');
    expect(formatDate('2026-10-25')).toBe('Sun 25 Oct 2026');
  });

  it('returns anything that is not a date unchanged', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
