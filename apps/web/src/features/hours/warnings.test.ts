import { describe, expect, it } from 'vitest';

import { countWarnings, WARNING_LABELS } from './warnings';

describe('countWarnings', () => {
  it('counts each code once, in first-seen order, with a count when repeated', () => {
    expect(
      countWarnings([
        { code: 'MISSING_DAY' },
        { code: 'BELOW_MINIMUM' },
        { code: 'MISSING_DAY' },
        { code: 'BREAK_RAISED' },
      ]),
    ).toEqual([
      { code: 'MISSING_DAY', count: 2, note: false, label: 'Day not recorded (2)' },
      { code: 'BELOW_MINIMUM', count: 1, note: false, label: 'Below minimum' },
      { code: 'BREAK_RAISED', count: 1, note: true, label: 'Break raised to minimum' },
    ]);
  });

  it('has sentence-case copy for every code', () => {
    for (const label of Object.values(WARNING_LABELS)) {
      expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
      expect(label).not.toMatch(/_/);
    }
  });
});
