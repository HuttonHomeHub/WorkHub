import { describe, expect, it } from 'vitest';

import { apiRange, presetOf, presetRange, rangeProblem, resolveRange } from './summary-range';

describe('summary range', () => {
  const today = '2026-10-14';

  it('turns presets into inclusive ranges as of today', () => {
    expect(presetRange('this-month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(presetRange('last-month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('this-year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetRange('custom', today)).toBeNull();
    // Last month from January is December of the year before.
    expect(presetRange('last-month', '2027-01-05')).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    });
  });

  it('recognises a preset range, and anything else is custom', () => {
    expect(presetOf({ from: '2026-09-01', to: '2026-09-30' }, today)).toBe('last-month');
    expect(presetOf({ from: '2026-09-01', to: '2026-09-29' }, today)).toBe('custom');
  });

  it('defaults to this month unless the URL has both dates', () => {
    expect(resolveRange({}, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(resolveRange({ from: '2026-01-01' }, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(resolveRange({ from: '2026-01-01', to: '2026-02-01' }, today)).toEqual({
      from: '2026-01-01',
      to: '2026-02-01',
    });
  });

  it('allows one day up to 366 days, and explains anything else', () => {
    expect(rangeProblem({ from: '2026-10-01', to: '2026-10-01' })).toBeNull();
    expect(rangeProblem({ from: '2028-01-01', to: '2028-12-31' })).toBeNull();
    expect(rangeProblem({ from: '2026-01-01', to: '2027-01-01' })).toBeNull();
    expect(rangeProblem({ from: '2026-01-01', to: '2027-01-02' })).toBe(
      'Choose a range of 366 days or fewer.',
    );
    expect(rangeProblem({ from: '2026-10-02', to: '2026-10-01' })).toBe(
      'Choose an end date on or after the start date.',
    );
    expect(rangeProblem({ from: '', to: '2026-10-01' })).toBe('Enter both dates.');
  });

  it('sends the API an exclusive end', () => {
    expect(apiRange({ from: '2026-10-01', to: '2026-10-31' })).toEqual({
      from: '2026-10-01',
      to: '2026-11-01',
    });
  });
});
