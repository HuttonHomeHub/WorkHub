import {
  calculateHours,
  defaultWorkTerms,
  type HoursInput,
  parseTimeOfDay,
  shiftInstants,
  type WorkDayRow,
} from '@repo/domain';
import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useRecalculationNotice } from './hooks/use-recalculation-notice';
import { recalculationMessage } from './recalculation-message';

import { dismissToast, Toaster } from '@/components/ui/toast';

function day(date: string, start: string, end: string, breakMinutes = 30): WorkDayRow {
  return {
    date,
    ...shiftInstants(date, parseTimeOfDay(start) ?? 0, parseTimeOfDay(end) ?? 0),
    breakMinutes,
    leaveMinutes: 0,
    toilTakenMinutes: 0,
    bankHolidayWorked: false,
  };
}

function run(days: WorkDayRow[], weekStart: string, asOf: string) {
  const input: HoursInput = {
    terms: [defaultWorkTerms(weekStart)],
    days,
    conversions: [weekStart],
    publicHolidays: [],
    adjustments: [],
    leaveYears: [],
    asOf,
  };
  return calculateHours(input);
}

// The feature doc's worked example, week of Mon 5 Oct 2026, settled on Fri 9 Oct.
const example = [
  day('2026-10-05', '08:00', '17:30'),
  day('2026-10-06', '07:30', '18:00'),
  day('2026-10-07', '08:00', '16:00'),
  day('2026-10-08', '08:00', '17:00', 15),
  day('2026-10-09', '08:00', '13:30', 0),
];

// The cross-month example: week of Mon 28 Sep 2026, settling Fri 2 Oct.
const crossMonth = [
  day('2026-09-28', '08:00', '18:00'),
  day('2026-09-29', '08:00', '16:00'),
  day('2026-09-30', '08:00', '16:00'),
  day('2026-10-01', '08:00', '17:00'),
  day('2026-10-02', '08:00', '16:00'),
];

afterEach(() => {
  act(() => dismissToast());
});

describe('recalculationMessage', () => {
  it("names the week and its TOIL and overtime before and after a settled week's edit", () => {
    const before = run(example, '2026-10-05', '2026-10-12');
    const edited = example.map((row) =>
      row.date === '2026-10-06' ? day('2026-10-06', '07:30', '17:00') : row,
    );
    const after = run(edited, '2026-10-05', '2026-10-12');
    expect(recalculationMessage(before, after, '2026-10-05')).toBe(
      'Week of 5 Oct recalculated: TOIL 3:00 → 2:00, overtime 0:00 → 0:00.',
    );
  });

  it('adds the ended month whose totals moved', () => {
    const before = run(crossMonth, '2026-09-28', '2026-10-05');
    const edited = crossMonth.map((row) =>
      row.date === '2026-09-28' ? day('2026-09-28', '08:00', '17:00') : row,
    );
    const after = run(edited, '2026-09-28', '2026-10-05');
    expect(recalculationMessage(before, after, '2026-09-28')).toBe(
      'Week of 28 Sep recalculated: TOIL 3:00 → 2:00, overtime 0:00 → 0:00. September totals changed.',
    );
  });

  it('says nothing when the edit moved neither the conversion nor an ended month', () => {
    const before = run(example, '2026-10-05', '2026-10-12');
    const after = run(example, '2026-10-05', '2026-10-12');
    expect(recalculationMessage(before, after, '2026-10-05')).toBeNull();
  });
});

describe('useRecalculationNotice', () => {
  it('raises an info toast and keeps the message for the live region', () => {
    render(<Toaster label="Notifications" dismissLabel="Dismiss notification" />);
    const { result, rerender } = renderHook(({ week }) => useRecalculationNotice(week), {
      initialProps: { week: '2026-10-05' },
    });
    const before = run(example, '2026-10-05', '2026-10-12');
    const after = run(
      example.map((row) => (row.date === '2026-10-06' ? day('2026-10-06', '07:30', '17:00') : row)),
      '2026-10-05',
      '2026-10-12',
    );

    let message: string | null = null;
    act(() => {
      message = result.current.notify(before, after, '2026-10-05');
    });
    expect(message).toMatch(/^Week of 5 Oct recalculated/);
    expect(result.current.notice).toBe(message);
    expect(screen.getAllByText(/Week of 5 Oct recalculated/).length).toBeGreaterThan(0);

    // An edit that changes nothing leaves the notice as it was and raises nothing.
    act(() => {
      expect(result.current.notify(before, before, '2026-10-05')).toBeNull();
    });
    expect(result.current.notice).toBe(message);

    // Another week has no notice.
    rerender({ week: '2026-10-12' });
    expect(result.current.notice).toBe('');
  });
});
