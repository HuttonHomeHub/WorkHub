import { describe, expect, it } from 'vitest';

import { toCsv } from '../core/csv.js';

import { daysCsvRows, DAYS_CSV_HEADER } from './csv.js';
import { calculateHours } from './engine.js';
import { day, input } from './test-helpers.js';

describe('daysCsvRows', () => {
  const rows = [
    day('2026-10-05', '08:00', '17:30', { breakMinutes: 30 }),
    day('2026-10-06', null, null, { leaveMinutes: 450 }),
    day('2026-10-09', '22:00', '06:00', { breakMinutes: 15 }),
  ];
  const result = calculateHours(input('2026-10-05', '2026-10-12', { days: rows }));

  it('lists recorded days in range with h:mm and decimal hours', () => {
    const csv = daysCsvRows(result, rows, '2026-10-05', '2026-10-12');
    expect(csv[0]).toEqual(DAYS_CSV_HEADER);
    expect(csv).toHaveLength(4);
    expect(csv[1]).toEqual([
      '2026-10-05',
      '08:00',
      '17:30',
      'No',
      '0:30',
      '0:30',
      '9:00',
      9,
      '0:00',
      0,
      '0:00',
      0,
      '0:00',
      '9:00',
      9,
      '1:30',
      1.5,
      '0:00',
      0,
    ]);
    expect(csv[2]).toEqual(expect.arrayContaining(['2026-10-06', null, '7:30', 7.5]));
    // A night shift: ends the next day; a 0:15 break is raised to the 0:30 minimum.
    expect(csv[3]!.slice(0, 7)).toEqual([
      '2026-10-09',
      '22:00',
      '06:00',
      'Yes',
      '0:15',
      '0:30',
      '7:30',
    ]);
  });

  it('leaves out days before the range and unrecorded days', () => {
    const csv = daysCsvRows(result, rows, '2026-10-06', '2026-10-09');
    expect(csv.slice(1).map((r) => r[0])).toEqual(['2026-10-06']);
  });

  it('shows negative flexi with a true minus sign in text, and a plain number in hours', () => {
    const short = [day('2026-10-05', '08:00', '12:00')];
    const csv = toCsv(
      daysCsvRows(
        calculateHours(input('2026-10-05', '2026-10-06', { days: short })),
        short,
        '2026-10-05',
        '2026-10-06',
      ),
      { bom: false },
    );
    expect(csv).toContain('−3:30,-3.5');
  });
});
