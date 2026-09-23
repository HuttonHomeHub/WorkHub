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
import { recalculationMessage, summaryRecalculationMessage } from './recalculation-message';

import { dismissToast, Toaster } from '@/components/ui/toast';
import { summaryGroup } from '@/test/hours-fixtures';

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

/** A month group from `time-summaries`, with the figures rule 11 compares. */
function month(key: string, end: string, overrides: Parameters<typeof summaryGroup>[0] = {}) {
  // A month group has none of a week group's conversion fields.
  const {
    conversion: _conversion,
    settlementDate: _settlementDate,
    excessMinutes: _excess,
    conversionToilMinutes: _toil,
    conversionOvertimePaidMinutes: _paid,
    conversionOvertimeUnpaidMinutes: _unpaid,
    ...group
  } = summaryGroup({ key, start: `${key}-01`, end, ...overrides });
  return group;
}

describe('summaryRecalculationMessage', () => {
  // The worked example applied: 1:00 TOIL and 2:00 unpaid overtime.
  const applied = summaryGroup();

  it("names the applied week's TOIL and overtime before and after", () => {
    const after = summaryGroup({
      conversionToilMinutes: 60,
      conversionOvertimeUnpaidMinutes: 60,
      excessMinutes: 120,
    });
    expect(
      summaryRecalculationMessage(
        { week: applied, months: [] },
        { week: after, months: [] },
        '2026-10-05',
        '2026-10-12',
      ),
    ).toBe('Week of 5 Oct recalculated: TOIL 1:00 → 1:00, overtime 2:00 → 1:00.');
  });

  it('says nothing for a preview, or when the conversion did not move', () => {
    const preview = summaryGroup({ conversion: 'PREVIEW' });
    const previewAfter = summaryGroup({ conversion: 'PREVIEW', conversionToilMinutes: 0 });
    expect(
      summaryRecalculationMessage(
        { week: preview, months: [] },
        { week: previewAfter, months: [] },
        '2026-10-05',
        '2026-10-08',
      ),
    ).toBeNull();
    expect(
      summaryRecalculationMessage(
        { week: applied, months: [] },
        { week: summaryGroup({ creditedMinutes: 2400 }), months: [] },
        '2026-10-05',
        '2026-10-12',
      ),
    ).toBeNull();
  });

  it('adds an ended month whose totals moved, and ignores one still running', () => {
    const september = month('2026-09', '2026-10-01', { toilMinutes: 120 });
    const october = month('2026-10', '2026-11-01', { toilMinutes: 60 });
    const week = summaryGroup({ key: '2026-09-28', start: '2026-09-28', end: '2026-10-05' });
    expect(
      summaryRecalculationMessage(
        { week, months: [september, october] },
        {
          week,
          months: [
            { ...september, toilMinutes: 0, overtimeUnpaidMinutes: 240 },
            { ...october, toilMinutes: 0 },
          ],
        },
        '2026-09-28',
        '2026-10-05',
      ),
    ).toBe('Week of 28 Sep recalculated. September totals changed.');
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
    const message = recalculationMessage(before, after, '2026-10-05');
    expect(message).toMatch(/^Week of 5 Oct recalculated/);

    act(() => result.current.announce(message, '2026-10-05'));
    expect(result.current.notice).toBe(message);
    expect(screen.getAllByText(/Week of 5 Oct recalculated/).length).toBeGreaterThan(0);

    // An edit that changes nothing leaves the notice as it was and raises nothing.
    act(() => result.current.announce(null, '2026-10-05'));
    expect(result.current.notice).toBe(message);

    // Another week has no notice.
    rerender({ week: '2026-10-12' });
    expect(result.current.notice).toBe('');
  });
});
