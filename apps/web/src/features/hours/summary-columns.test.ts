import { toCsv } from '@repo/domain';
import { describe, expect, it } from 'vitest';

import { periodLabel, periodState, summaryCsvRows, summaryTotals } from './summary-columns';

import { summaryGroup } from '@/test/hours-fixtures';

describe('summary columns', () => {
  const weeks = [
    summaryGroup({
      key: '2026-09-28',
      start: '2026-09-28',
      end: '2026-10-05',
      flexiMinutes: -130,
      convertedMinutes: 0,
      toilMinutes: 0,
      overtimeUnpaidMinutes: 0,
      flexiBalanceEndMinutes: 12,
      conversion: 'OFF',
      warnings: [
        { code: 'MISSING_DAY', date: '2026-09-28' },
        { code: 'MISSING_DAY', date: '2026-09-29' },
        { code: 'BELOW_MINIMUM', date: '2026-10-01' },
      ],
    }),
    summaryGroup(),
  ];

  it('says where a period stands on a day: past, in progress or upcoming', () => {
    const week = { start: '2026-10-05', end: '2026-10-12' };
    expect(periodState(week, '2026-10-04')).toBe('upcoming');
    expect(periodState(week, '2026-10-05')).toBe('in-progress');
    expect(periodState(week, '2026-10-11')).toBe('in-progress');
    // The end is exclusive: the week is over on the next Monday.
    expect(periodState(week, '2026-10-12')).toBe('past');
  });

  it('labels weeks and months', () => {
    expect(periodLabel(summaryGroup(), 'week')).toBe('Week of 5 Oct 2026');
    expect(
      periodLabel(
        summaryGroup({ key: '2026-10', start: '2026-10-01', end: '2026-11-01' }),
        'month',
      ),
    ).toBe('October 2026');
  });

  it('sums every figure, and takes the flexi balance from the last group', () => {
    const totals = summaryTotals(weeks);
    expect(totals.workedMinutes).toBe(4860);
    expect(totals.flexiMinutes).toBe(-130);
    expect(totals.overtimeUnpaidMinutes).toBe(120);
    expect(totals.flexiBalanceEndMinutes).toBe(192);
    expect(summaryTotals([]).flexiBalanceEndMinutes).toBe(0);
  });

  it('builds CSV rows in h:mm and decimal hours, with a totals row', () => {
    const rows = summaryCsvRows(weeks, 'week');
    const header = rows[0] ?? [];
    expect(header.slice(0, 5)).toEqual(['Week', 'From', 'To', 'Target (h:mm)', 'Target (hours)']);
    expect(header.slice(-3)).toEqual(['Flexi balance at end (hours)', 'Conversion', 'Warnings']);
    const first = rows[1] ?? [];
    expect(first.slice(0, 5)).toEqual([
      'Week of 28 Sep 2026',
      '2026-09-28',
      '2026-10-04',
      '37:30',
      37.5,
    ]);
    const flexi = header.indexOf('Flexi (h:mm)');
    expect(first.slice(flexi, flexi + 2)).toEqual(['−2:10', -2.17]);
    expect(first.slice(-2)).toEqual(['Off', 'Day not recorded (2); Below minimum']);
    const total = rows.at(-1) ?? [];
    expect(total.slice(0, 3)).toEqual(['Total', '2026-09-28', '2026-10-11']);
    const worked = header.indexOf('Worked (h:mm)');
    expect(total.slice(worked, worked + 2)).toEqual(['81:00', 81]);
    expect(rows).toHaveLength(4);
  });

  it('has no conversion column by month, and writes safe CSV', () => {
    const month = summaryGroup({ key: '2026-10', start: '2026-10-01', end: '2026-11-01' });
    const rows = summaryCsvRows([month], 'month');
    expect(rows[0]).not.toContain('Conversion');
    const csv = toCsv(rows);
    expect(csv.startsWith('\uFEFFMonth,From,To,')).toBe(true);
    expect(csv).toContain('\r\nOctober 2026,2026-10-01,2026-10-31,37:30,37.5,');
    // The minus in a negative figure is the true minus, never a formula start.
    expect(toCsv(summaryCsvRows([summaryGroup({ flexiMinutes: -60 })], 'week'))).toContain(
      ',−1:00,-1,',
    );
  });
});
