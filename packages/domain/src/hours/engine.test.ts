import { describe, expect, it } from 'vitest';

import { defaultWorkTerms } from './defaults.js';
import { calculateHours, HoursInputError } from './engine.js';
import { recalculation } from './recalculation.js';
import { balancesAt, summarise } from './summary.js';
import { day, input, m } from './test-helpers.js';
import type { DayResult, HoursInput, HoursResult } from './types.js';

const dayOf = (result: HoursResult, date: string): DayResult => {
  const found = result.days.find((d) => d.date === date);
  if (!found) throw new Error(`no result for ${date}`);
  return found;
};
const codes = (result: HoursResult, date: string) =>
  dayOf(result, date).warnings.map((w) => w.code);

// The feature doc's worked example: week of Monday 5 October 2026.
const exampleWeek = [
  day('2026-10-05', '08:00', '17:30', { breakMinutes: 30 }),
  day('2026-10-06', '07:30', '18:00', { breakMinutes: 30 }),
  day('2026-10-07', '08:00', '16:00', { breakMinutes: 30 }),
  day('2026-10-08', '08:00', '17:00', { breakMinutes: 15 }),
  day('2026-10-09', '08:00', '13:30'),
];

describe('worked example, week of 5 October 2026', () => {
  it('switch off: daily flexi and a running balance', () => {
    const result = calculateHours(input('2026-10-05', '2026-10-10', { days: exampleWeek }));

    const worked = exampleWeek.map((d) => dayOf(result, d.date).workedMinutes);
    const flexi = exampleWeek.map((d) => dayOf(result, d.date).dayFlexiMinutes);
    const balance = exampleWeek.map((d) => dayOf(result, d.date).flexiBalanceMinutes);
    expect(worked).toEqual([m('9:00'), m('10:00'), m('7:30'), m('8:30'), m('5:30')]);
    expect(flexi).toEqual([m('1:30'), m('2:30'), 0, m('1:00'), m('-2:00')]);
    expect(balance).toEqual([m('1:30'), m('4:00'), m('4:00'), m('5:00'), m('3:00')]);

    // Thursday's 0:15 break is raised to the 0:30 minimum (a note); Friday's
    // 5:30 meets its minimum, so no warning.
    expect(dayOf(result, '2026-10-08').breakDeductedMinutes).toBe(30);
    expect(codes(result, '2026-10-08')).toContain('BREAK_RAISED');
    expect(codes(result, '2026-10-09')).not.toContain('BELOW_MINIMUM');

    const [week] = summarise(result, '2026-10-05', '2026-10-12', 'week');
    expect(week).toMatchObject({
      workedMinutes: m('40:30'),
      targetMinutes: m('37:30'),
      rawFlexiMinutes: m('3:00'),
      flexiMinutes: m('3:00'),
      conversion: 'OFF',
    });
  });

  it('switch on: levels 3:00 into TOIL up to the cap and unpaid overtime', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-10', {
        days: exampleWeek,
        conversions: ['2026-10-05'],
        // 6:30 of TOIL already converted on 1–2 October.
        adjustments: [{ effectiveDate: '2026-10-05', balance: 'TOIL', minutes: m('6:30') }],
      }),
    );

    const week = result.weeks.find((w) => w.weekStart === '2026-10-05')!;
    expect(week.conversion).toBe('APPLIED');
    expect(week.excessMinutes).toBe(m('3:00'));
    expect(week.allocation).toEqual({
      '2026-10-05': m('0:50'),
      '2026-10-06': m('1:50'),
      '2026-10-08': m('0:20'),
    });

    const rows = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((d) => {
      const r = dayOf(result, d);
      return [r.dayFlexiMinutes, r.toilMinutes, r.overtimeUnpaidMinutes];
    });
    expect(rows).toEqual([
      [m('0:40'), m('0:50'), 0],
      [m('0:40'), m('0:10'), m('1:40')],
      [0, 0, 0],
      [m('0:40'), 0, m('0:20')],
      [m('-2:00'), 0, 0],
    ]);
    expect(week).toMatchObject({
      toilMinutes: m('1:00'),
      overtimeUnpaidMinutes: m('2:00'),
      overtimePaidMinutes: 0,
    });
    expect(dayOf(result, '2026-10-09').flexiBalanceMinutes).toBe(0);
  });

  it('month end: TOIL unused in October becomes unpaid overtime on 31 October', () => {
    const tookToil = day('2026-10-14', '08:00', '10:30', { toilTakenMinutes: m('5:00') });
    const result = calculateHours(
      input('2026-10-05', '2026-11-02', {
        days: [
          ...exampleWeek,
          tookToil,
          // Keep the rest of October neutral: 7:30 days.
          ...neutralDays('2026-10-12', '2026-11-02', ['2026-10-14']),
        ],
        conversions: ['2026-10-05'],
        adjustments: [{ effectiveDate: '2026-10-05', balance: 'TOIL', minutes: m('6:30') }],
      }),
    );

    const october = result.months.find((x) => x.month === '2026-10')!;
    expect(october).toMatchObject({
      ended: true,
      toilMinutes: m('7:30'),
      toilTakenMinutes: m('5:00'),
      toilUnusedMinutes: m('2:30'),
    });
    const lastDay = dayOf(result, '2026-10-31');
    expect(lastDay.toilUnusedMinutes).toBe(m('2:30'));
    expect(lastDay.overtimeUnpaidMinutes).toBe(m('2:30'));
    expect(codes(result, '2026-10-31')).toContain('TOIL_UNUSED');
  });
});

/** 07:30-worked days (08:00–16:00 with a 0:30 break) on working days in [from, to). */
function neutralDays(from: string, to: string, skip: string[] = []) {
  const out = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) < to;) {
    const date = d.toISOString().slice(0, 10);
    const weekday = d.getUTCDay();
    if (weekday >= 1 && weekday <= 5 && !skip.includes(date)) {
      out.push(day(date, '08:00', '16:00', { breakMinutes: 30 }));
    }
    d = new Date(d.getTime() + 86_400_000);
  }
  return out;
}

describe('cross-month week, switch on (week of 28 September 2026)', () => {
  const days = [
    day('2026-09-28', '08:00', '18:00', { breakMinutes: 30 }), // 9:30
    day('2026-09-29', '08:00', '16:00', { breakMinutes: 30 }),
    day('2026-09-30', '08:00', '16:00', { breakMinutes: 30 }),
    day('2026-10-01', '08:00', '17:00', { breakMinutes: 30 }), // 8:30
    day('2026-10-02', '08:00', '16:00', { breakMinutes: 30 }),
  ];
  const base = { days, conversions: ['2026-09-28'] };

  it('allocates by date: September TOIL becomes overtime on 30 Sep, October keeps its TOIL', () => {
    const result = calculateHours(input('2026-09-28', '2026-10-02', base));
    const week = result.weeks[0]!;
    expect(week.conversion).toBe('APPLIED');
    expect(week.allocation).toEqual({ '2026-09-28': m('2:00'), '2026-10-01': m('1:00') });

    const september = result.months.find((x) => x.month === '2026-09')!;
    expect(september).toMatchObject({
      ended: true,
      toilMinutes: m('2:00'),
      toilUnusedMinutes: m('2:00'),
    });
    expect(dayOf(result, '2026-09-30').overtimeUnpaidMinutes).toBe(m('2:00'));
    const october = result.months.find((x) => x.month === '2026-10')!;
    expect(october).toMatchObject({ ended: false, toilMinutes: m('1:00') });
  });

  it('before settlement it is only a preview, and September shows no TOIL', () => {
    const result = calculateHours(input('2026-09-28', '2026-10-01', base));
    const week = result.weeks[0]!;
    expect(week.conversion).toBe('PREVIEW');
    expect(week).toMatchObject({ toilMinutes: m('1:00'), overtimeUnpaidMinutes: m('2:00') });
    expect(result.days.every((d) => d.convertedMinutes === 0)).toBe(true);
    expect(result.months.find((x) => x.month === '2026-09')!.toilMinutes).toBe(0);
  });

  it('rule 11: settlement reports the change and that September totals changed', () => {
    const before = calculateHours(input('2026-09-28', '2026-10-02', { ...base, conversions: [] }));
    const after = calculateHours(input('2026-09-28', '2026-10-02', base));
    const diff = recalculation(before, after, '2026-09-28');
    expect(diff.changed).toBe(true);
    expect(diff.before.toilByMonth).toEqual({});
    expect(diff.after).toMatchObject({
      excessMinutes: m('3:00'),
      toilByMonth: { '2026-09': m('2:00'), '2026-10': m('1:00') },
      overtimeByMonth: { '2026-09': 0, '2026-10': 0 },
    });
    expect(diff.closedMonthsChanged).toEqual(['2026-09']);
  });
});

describe('clock changes', () => {
  // Spans over 6:00 have the 0:30 minimum break deducted, so worked = span − 0:30.
  it.each([
    ['2026-03-28', '22:00', '06:00', m('7:00')],
    ['2026-10-24', '22:00', '06:00', m('9:00')],
    ['2027-03-27', '22:00', '06:00', m('7:00')],
    ['2027-10-30', '22:00', '06:00', m('9:00')],
  ])('a night from %s %s to %s spans %i minutes', (date, start, end, span) => {
    const result = calculateHours(
      input('2026-03-23', `${date.slice(0, 4)}-12-01`, { days: [day(date, start, end)] }),
    );
    const d = dayOf(result, date);
    expect(d.spanMinutes).toBe(span);
    expect(d.workedMinutes).toBe(span - 30);
    // A Saturday: target 0, so all of it is flexi; the night is outside the band.
    expect(d.rawFlexiMinutes).toBe(span - 30);
    expect(codes(result, date)).toContain('OUTSIDE_BAND');
  });

  it('00:30–03:30 on the autumn change day is 4:00 of elapsed time', () => {
    const result = calculateHours(
      input('2026-10-19', '2026-10-26', {
        days: [
          {
            ...day('2026-10-25', null, null),
            startsAt: '2026-10-24T23:30:00.000Z', // 00:30 BST
            endsAt: '2026-10-25T03:30:00.000Z', // 03:30 GMT
          },
        ],
      }),
    );
    expect(dayOf(result, '2026-10-25').spanMinutes).toBe(m('4:00'));
  });

  it('keeps week totals right across the spring change', () => {
    const result = calculateHours(
      input('2026-03-23', '2026-03-30', {
        days: [...neutralDays('2026-03-23', '2026-03-28'), day('2026-03-28', '22:00', '06:00')],
      }),
    );
    const [week] = summarise(result, '2026-03-23', '2026-03-30', 'week');
    expect(week).toMatchObject({
      workedMinutes: m('37:30') + m('6:30'),
      rawFlexiMinutes: m('6:30'),
    });
  });
});

describe('worked time (rule 3)', () => {
  const at = (start: string, end: string, breakMinutes = 0) =>
    dayOf(
      calculateHours(
        input('2026-10-05', '2026-10-06', {
          days: [day('2026-10-05', start, end, { breakMinutes })],
        }),
      ),
      '2026-10-05',
    );

  it('deducts only the recorded break at exactly 6:00', () => {
    expect(at('08:00', '14:00').workedMinutes).toBe(m('6:00'));
  });
  it('deducts the 0:30 minimum at 6:01', () => {
    expect(at('08:00', '14:01').workedMinutes).toBe(m('5:31'));
  });
  it('keeps a recorded break above the minimum', () => {
    expect(at('08:00', '17:00', 45).workedMinutes).toBe(m('8:15'));
  });
  it('raises a recorded break below the minimum', () => {
    const d = at('08:00', '17:00', 10);
    expect(d).toMatchObject({ breakDeductedMinutes: 30, workedMinutes: m('8:30') });
    expect(d.warnings.map((w) => w.code)).toContain('BREAK_RAISED');
  });
  it('counts a night shift wholly to its row date', () => {
    const d = at('20:00', '04:00');
    expect(d.workedMinutes).toBe(m('7:30'));
  });

  it.each([
    ['zero', '2026-10-05T08:00:00.000Z', '2026-10-05T08:00:00.000Z'],
    ['negative', '2026-10-05T09:00:00.000Z', '2026-10-05T08:00:00.000Z'],
    ['over 24 hours', '2026-10-05T08:00:00.000Z', '2026-10-06T08:01:00.000Z'],
  ])('ignores an invalid %s span and warns', (_, startsAt, endsAt) => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-06', {
        days: [{ ...day('2026-10-05', null, null), startsAt, endsAt }],
      }),
    );
    expect(dayOf(result, '2026-10-05').workedMinutes).toBe(0);
    expect(codes(result, '2026-10-05')).toContain('INVALID_SPAN');
  });
});

describe('day flexi (rules 4 and 5)', () => {
  it('counts today only once it has a row', () => {
    const empty = calculateHours(input('2026-10-05', '2026-10-07'));
    expect(dayOf(empty, '2026-10-07')).toMatchObject({ counted: false, rawFlexiMinutes: 0 });
    const withRow = calculateHours(
      input('2026-10-05', '2026-10-07', { days: [day('2026-10-07', '08:00', '12:00')] }),
    );
    expect(dayOf(withRow, '2026-10-07')).toMatchObject({
      counted: true,
      rawFlexiMinutes: m('-3:30'),
    });
  });

  it('counts a missing past working day as −target, with a warning', () => {
    const result = calculateHours(input('2026-10-05', '2026-10-07'));
    expect(dayOf(result, '2026-10-05').rawFlexiMinutes).toBe(m('-7:30'));
    expect(codes(result, '2026-10-05')).toContain('MISSING_DAY');
    expect(codes(result, '2026-10-06')).toContain('MISSING_DAY');
    expect(codes(result, '2026-10-07')).not.toContain('MISSING_DAY');
    expect(dayOf(result, '2026-10-06').flexiBalanceMinutes).toBe(m('-15:00'));
  });

  it('makes weekend work all flexi (target 0), with no missing-day warning', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-12', { days: [day('2026-10-10', '09:00', '12:00')] }),
    );
    expect(dayOf(result, '2026-10-10')).toMatchObject({
      working: false,
      rawFlexiMinutes: m('3:00'),
    });
    expect(codes(result, '2026-10-11')).not.toContain('MISSING_DAY');
  });

  it('credits leave, TOIL taken and a bank holiday up to the target', () => {
    const result = calculateHours(
      input('2026-12-21', '2026-12-30', {
        publicHolidays: ['2026-12-25'],
        days: [
          day('2026-12-21', null, null, { leaveMinutes: m('7:30') }),
          day('2026-12-22', '08:00', '12:00', { leaveMinutes: m('3:30') }),
          day('2026-12-23', null, null, { toilTakenMinutes: m('7:30') }),
          day('2026-12-24', '08:00', '11:45', { leaveMinutes: m('3:45') }),
        ],
      }),
    );
    for (const date of ['2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25']) {
      expect(dayOf(result, date).rawFlexiMinutes).toBe(0);
    }
    expect(dayOf(result, '2026-12-25')).toMatchObject({
      bankHoliday: true,
      bankHolidayMinutes: m('7:30'),
    });
    expect(codes(result, '2026-12-25')).not.toContain('MISSING_DAY');
  });

  it('gives no credit on a bank holiday marked as worked', () => {
    const result = calculateHours(
      input('2026-12-21', '2026-12-30', {
        publicHolidays: ['2026-12-25'],
        days: [day('2026-12-25', '08:00', '12:00', { bankHolidayWorked: true })],
      }),
    );
    expect(dayOf(result, '2026-12-25')).toMatchObject({
      bankHolidayMinutes: 0,
      rawFlexiMinutes: m('-3:30'),
    });
  });

  it('applies a terms change from its Monday, never before', () => {
    const later = {
      ...defaultWorkTerms('2026-10-12'),
      targetMinutes: { mon: 480, tue: 480, wed: 480, thu: 480, fri: 330, sat: null, sun: null },
    };
    const result = calculateHours({
      ...input('2026-10-05', '2026-10-20', {
        days: [
          day('2026-10-09', '08:00', '16:00', { breakMinutes: 30 }),
          day('2026-10-16', '08:00', '16:00', { breakMinutes: 30 }),
        ],
      }),
      terms: [later, defaultWorkTerms('2026-10-05')],
    });
    expect(dayOf(result, '2026-10-09').rawFlexiMinutes).toBe(0);
    expect(dayOf(result, '2026-10-16').rawFlexiMinutes).toBe(m('2:00'));
    expect(dayOf(result, '2026-10-12').targetMinutes).toBe(480);
  });
});

describe('conversion (rule 6)', () => {
  const on = (asOf: string, days = exampleWeek, extra: Partial<HoursInput> = {}) =>
    calculateHours(input('2026-10-05', asOf, { days, conversions: ['2026-10-05'], ...extra }));

  it('is a preview before settlement and applied from it', () => {
    const thursday = on('2026-10-08', exampleWeek.slice(0, 3));
    expect(thursday.weeks[0]!.conversion).toBe('PREVIEW');
    expect(thursday.weeks[0]!.excessMinutes).toBe(m('4:00'));
    expect(dayOf(thursday, '2026-10-06').previewConvertedMinutes).toBeGreaterThan(0);
    expect(balancesAt(thursday).flexiMinutes).toBe(m('4:00'));

    const friday = on('2026-10-09');
    expect(friday.weeks[0]!.conversion).toBe('APPLIED');
    expect(balancesAt(friday).flexiMinutes).toBe(0);
  });

  it('allocates nothing in a net negative week and keeps the switch on', () => {
    const result = on('2026-10-10', [day('2026-10-05', '08:00', '18:00', { breakMinutes: 30 })]);
    expect(result.weeks[0]).toMatchObject({
      conversion: 'APPLIED',
      excessMinutes: 0,
      allocation: {},
    });
  });

  it('takes from the latest date when surpluses are equal', () => {
    const nine = (d: string) => day(d, '08:00', '17:30', { breakMinutes: 30 });
    const result = on(
      '2026-10-10',
      ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map(nine),
    );
    // E = 5 × 1:30 = 7:30; every day gives 1:30, but along the way ties go latest first.
    expect(result.weeks[0]!.allocation).toEqual({
      '2026-10-05': 90,
      '2026-10-06': 90,
      '2026-10-07': 90,
      '2026-10-08': 90,
      '2026-10-09': 90,
    });
    const odd = on('2026-10-10', [
      nine('2026-10-05'),
      nine('2026-10-06'),
      day('2026-10-07', '08:00', '15:59', { breakMinutes: 30 }),
      nine('2026-10-08'),
      nine('2026-10-09'),
    ]);
    // E = 4 × 1:30 − 0:01 = 5:59: the earliest date gives one minute less.
    expect(odd.weeks[0]!.allocation).toMatchObject({ '2026-10-05': 89, '2026-10-09': 90 });
  });

  it('takes minutes below the target when that is where the level falls', () => {
    // Mon 12:00 worked, Tue–Fri 7:30 but Friday is leave: E = 4:30, Mon alone gives it.
    const result = on('2026-10-10', [
      day('2026-10-05', '06:00', '18:30', { breakMinutes: 30 }),
      ...['2026-10-06', '2026-10-07', '2026-10-08'].map((d) =>
        day(d, '08:00', '16:00', { breakMinutes: 30 }),
      ),
      day('2026-10-09', null, null, { leaveMinutes: m('7:30') }),
    ]);
    expect(result.weeks[0]!.allocation).toEqual({ '2026-10-05': m('4:30') });
    // Now a week where levelling goes below target on several days.
    const tight = on('2026-10-10', [
      day('2026-10-05', '08:00', '16:00', { breakMinutes: 30 }),
      day('2026-10-06', '08:00', '16:00', { breakMinutes: 30 }),
      day('2026-10-10', '08:00', '11:00'),
    ]);
    // Mon–Tue 0 surplus, Wed–Fri missing (−22:30), Sat +3:00: net negative, nothing allocated.
    expect(tight.weeks[0]!.excessMinutes).toBe(0);
  });

  it('recomputes the excess when weekend time is added after settlement', () => {
    const before = on('2026-10-12');
    const after = on('2026-10-12', [...exampleWeek, day('2026-10-10', '09:00', '11:00')]);
    expect(before.weeks[0]!.excessMinutes).toBe(m('3:00'));
    expect(after.weeks[0]!.excessMinutes).toBe(m('5:00'));
    // Saturday's target is 0, so its surplus (2:00) levels with the others.
    expect(after.weeks[0]!.allocation['2026-10-10']).toBeGreaterThan(0);
    expect(recalculation(before, after, '2026-10-05').changed).toBe(true);
  });

  it('settles on the last working day when that is not Friday', () => {
    const fourDays = {
      ...defaultWorkTerms('2026-10-05'),
      targetMinutes: { mon: 600, tue: 600, wed: 600, thu: 600, fri: null, sat: null, sun: null },
      minimumMinutes: { mon: 600, tue: 600, wed: 600, thu: 600, fri: null, sat: null, sun: null },
    };
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) =>
      day(d, '07:00', '18:30', { breakMinutes: 30 }),
    );
    const thursday = calculateHours({
      ...input('2026-10-05', '2026-10-08', { days, conversions: ['2026-10-05'] }),
      terms: [fourDays],
    });
    expect(thursday.weeks[0]).toMatchObject({
      settlementDate: '2026-10-08',
      conversion: 'APPLIED',
    });
  });
});

describe('months (rules 7 and 8)', () => {
  const convertOn = (days: ReturnType<typeof day>[], asOf: string, toilSoFar = 0) =>
    calculateHours(
      input('2026-10-05', asOf, {
        days,
        conversions: ['2026-10-05'],
        adjustments: toilSoFar
          ? [{ effectiveDate: '2026-10-05', balance: 'TOIL', minutes: toilSoFar }]
          : [],
      }),
    );
  const weekWithExcess = (extra: number) => [
    day(
      '2026-10-05',
      '08:00',
      `${String(16 + Math.floor(extra / 60)).padStart(2, '0')}:${String(extra % 60).padStart(2, '0')}`,
      { breakMinutes: 30 },
    ),
    ...['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((d) =>
      day(d, '08:00', '16:00', { breakMinutes: 30 }),
    ),
  ];

  it('fills the cap exactly at 7:30', () => {
    const result = convertOn(weekWithExcess(60), '2026-10-10', m('6:30'));
    expect(dayOf(result, '2026-10-05')).toMatchObject({
      toilMinutes: 60,
      overtimeUnpaidMinutes: 0,
    });
  });

  it('makes the minute over the cap overtime', () => {
    const result = convertOn(weekWithExcess(61), '2026-10-10', m('6:30'));
    expect(dayOf(result, '2026-10-05')).toMatchObject({
      toilMinutes: 60,
      overtimeUnpaidMinutes: 1,
    });
  });

  it('turns TOIL taken but not earned into a flexi debit at month end', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-11-02', {
        days: [
          day('2026-10-05', null, null, { toilTakenMinutes: m('2:00'), leaveMinutes: m('5:30') }),
          ...neutralDays('2026-10-06', '2026-11-02'),
        ],
      }),
    );
    const lastDay = dayOf(result, '2026-10-31');
    expect(lastDay.flexiDebitMinutes).toBe(m('2:00'));
    expect(codes(result, '2026-10-31')).toContain('TOIL_NOT_EARNED');
    expect(lastDay.flexiBalanceMinutes).toBe(m('-2:00'));
  });

  it('allows TOIL taken before it is converted in the same month', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-11-02', {
        days: [
          day('2026-10-05', '08:00', '15:00', { breakMinutes: 30, toilTakenMinutes: m('1:00') }),
          day('2026-10-06', '08:00', '17:00', { breakMinutes: 30 }),
          ...neutralDays('2026-10-07', '2026-11-02'),
        ],
        conversions: ['2026-10-05'],
      }),
    );
    // Monday 6:30 + 1:00 TOIL = 7:30; Tuesday +1:00 converts to TOIL; nothing left over.
    expect(result.months.find((x) => x.month === '2026-10')).toMatchObject({
      toilMinutes: 60,
      toilTakenMinutes: 60,
      toilUnusedMinutes: 0,
      flexiDebitMinutes: 0,
    });
  });

  it('settles the month only once asOf is after its last day', () => {
    const days = [...weekWithExcess(60), ...neutralDays('2026-10-12', '2026-11-01')];
    const onLastDay = convertOn(days, '2026-10-31');
    expect(onLastDay.months.find((x) => x.month === '2026-10')).toMatchObject({
      ended: false,
      toilUnusedMinutes: 0,
    });
    const after = convertOn(days, '2026-11-01');
    expect(after.months.find((x) => x.month === '2026-10')).toMatchObject({
      ended: true,
      toilUnusedMinutes: 60,
    });
  });
});

describe('paid or unpaid (rule 9)', () => {
  const days = [
    day('2026-10-05', '08:00', '18:00', { breakMinutes: 30 }), // +2:00
    ...['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((d) =>
      day(d, '08:00', '16:00', { breakMinutes: 30 }),
    ),
  ];
  const run = (terms: HoursInput['terms']) =>
    calculateHours({
      ...input('2026-10-05', '2026-10-10', {
        days,
        conversions: ['2026-10-05'],
        adjustments: [{ effectiveDate: '2026-10-05', balance: 'TOIL', minutes: m('7:30') }],
      }),
      terms,
    });

  it('is unpaid when paid overtime is not allowed', () => {
    expect(dayOf(run([defaultWorkTerms('2026-10-05')]), '2026-10-05')).toMatchObject({
      overtimeUnpaidMinutes: 120,
      overtimePaidMinutes: 0,
    });
  });

  it('is paid when allowed', () => {
    const terms = { ...defaultWorkTerms('2026-10-05'), paidOvertimeAllowed: true };
    expect(dayOf(run([terms]), '2026-10-05')).toMatchObject({ overtimePaidMinutes: 120 });
  });

  it('follows the terms on the overtime date when switched on mid-month', () => {
    const later = { ...defaultWorkTerms('2026-10-12'), paidOvertimeAllowed: true };
    const result = calculateHours({
      ...input('2026-10-05', '2026-11-02', {
        days: [...days, ...neutralDays('2026-10-12', '2026-11-02')],
        conversions: ['2026-10-05'],
        adjustments: [{ effectiveDate: '2026-10-05', balance: 'TOIL', minutes: m('6:30') }],
      }),
      terms: [defaultWorkTerms('2026-10-05'), later],
    });
    // 1:00 fills the cap; 1:00 overflows on 5 Oct (unpaid). The 7:30 unused at
    // month end is dated 31 Oct, when paid overtime is allowed.
    expect(dayOf(result, '2026-10-05')).toMatchObject({ overtimeUnpaidMinutes: 60 });
    expect(dayOf(result, '2026-10-31')).toMatchObject({ overtimePaidMinutes: m('7:30') });
    expect(balancesAt(result, '2026-11-01')).toMatchObject({
      overtimePaidYearMinutes: m('7:30'),
      overtimeUnpaidYearMinutes: 60,
    });
  });
});

describe('leave (rule 12)', () => {
  it('deducts bank holidays and adds bought leave', () => {
    const result = calculateHours(
      input('2026-01-05', '2026-06-01', {
        publicHolidays: ['2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25'],
        days: [day('2026-02-02', null, null, { leaveMinutes: m('7:30') })],
        leaveYears: [{ year: 2026, allowanceMinutes: m('247:30'), boughtLeave: true }],
      }),
    );
    const year = result.leaveYears.find((y) => y.year === 2026)!;
    expect(year.allowanceMinutes).toBe(m('285:00'));
    expect(year.usedMinutes).toBe(m('37:30'));
    expect(year.remainingMinutes).toBe(m('247:30'));
  });

  it('warns when leave goes over the allowance, and a leave adjustment counts', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-10', {
        days: [
          day('2026-10-05', null, null, { leaveMinutes: m('7:30') }),
          day('2026-10-06', null, null, { leaveMinutes: m('7:30') }),
        ],
        leaveYears: [{ year: 2026, allowanceMinutes: m('10:00'), boughtLeave: false }],
        adjustments: [{ effectiveDate: '2026-10-05', balance: 'LEAVE', minutes: m('2:00') }],
      }),
    );
    expect(result.leaveYears[0]!.remainingMinutes).toBe(m('-3:00'));
    expect(codes(result, '2026-10-06')).toContain('LEAVE_OVER_ALLOWANCE');
  });

  it('uses the 247:30 default for a year with no setting', () => {
    const result = calculateHours(input('2026-10-05', '2026-10-06'));
    expect(result.leaveYears[0]!.allowanceMinutes).toBe(m('247:30'));
  });
});

describe('flexi (rule 10)', () => {
  it('can go negative', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-06', { days: [day('2026-10-05', '08:00', '12:00')] }),
    );
    expect(balancesAt(result).flexiMinutes).toBe(m('-3:30'));
  });

  it('warns only when a set cap is crossed, and a confirmed forfeit is an adjustment', () => {
    const days = exampleWeek;
    const unset = calculateHours(input('2026-10-05', '2026-10-10', { days }));
    expect(unset.days.flatMap((d) => d.warnings).some((w) => w.code === 'FLEXI_CREDIT_CAP')).toBe(
      false,
    );

    const capped = calculateHours(
      input('2026-10-05', '2026-10-10', { days }, { flexiCreditCapMinutes: m('3:30') }),
    );
    expect(codes(capped, '2026-10-06')).toContain('FLEXI_CREDIT_CAP');
    expect(codes(capped, '2026-10-08')).not.toContain('FLEXI_CREDIT_CAP');

    const forfeited = calculateHours(
      input('2026-10-05', '2026-10-10', {
        days,
        adjustments: [{ effectiveDate: '2026-10-09', balance: 'FLEXI', minutes: m('-3:00') }],
      }),
    );
    expect(balancesAt(forfeited).flexiMinutes).toBe(0);
  });

  it('warns on the debit cap', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-08', {}, { flexiDebitCapMinutes: m('10:00') }),
    );
    expect(codes(result, '2026-10-06')).toContain('FLEXI_DEBIT_CAP');
  });
});

describe('warnings (rule 13)', () => {
  const at = (date: string, start: string, end: string, breakMinutes = 30) =>
    codes(
      calculateHours(
        input('2026-10-05', '2026-10-12', { days: [day(date, start, end, { breakMinutes })] }),
      ),
      date,
    );

  it('uses the 7:30 minimum Monday to Thursday and 5:30 on Friday', () => {
    expect(at('2026-10-08', '08:00', '14:00', 0)).toContain('BELOW_MINIMUM');
    expect(at('2026-10-09', '08:00', '14:00', 0)).not.toContain('BELOW_MINIMUM');
    expect(at('2026-10-09', '08:00', '13:29', 0)).toContain('BELOW_MINIMUM');
  });

  it('accepts the band edges 07:00 and 19:00 and warns one minute outside', () => {
    expect(at('2026-10-05', '07:00', '19:00')).not.toContain('OUTSIDE_BAND');
    expect(at('2026-10-05', '06:59', '15:00')).toContain('OUTSIDE_BAND');
    expect(at('2026-10-05', '08:00', '19:01')).toContain('OUTSIDE_BAND');
  });
});

describe('no terms yet', () => {
  it('tracks nothing', () => {
    const result = calculateHours({ ...input('2026-10-05', '2026-10-10'), terms: [] });
    expect(result).toMatchObject({ trackingStart: null, days: [], weeks: [] });
    expect(balancesAt(result).flexiMinutes).toBe(0);
  });
});

describe('robustness (security review)', () => {
  it('rejects dates outside 2000–2100 with a typed error, before doing any work', () => {
    expect(() => calculateHours(input('1000-01-06', '2026-10-10'))).toThrow(HoursInputError);
    expect(() =>
      calculateHours(input('2026-10-05', '2026-10-10'), { until: '9999-12-31' }),
    ).toThrow(HoursInputError);
    expect(() => calculateHours(input('2026-10-05', '0050-01-01'))).toThrow(HoursInputError);
    expect(() =>
      calculateHours(input('2026-10-05', '2026-10-10', { days: [day('2026-02-30', null, null)] })),
    ).toThrow(HoursInputError);
  });

  it('treats malformed instants as an invalid span instead of throwing', () => {
    for (const startsAt of ['garbage', '2026-10-05T08:00:00', 'Oct 5 2026 07:00 GMT']) {
      const result = calculateHours(
        input('2026-10-05', '2026-10-06', {
          days: [{ ...day('2026-10-05', null, null), startsAt, endsAt: '2026-10-05T16:00:00Z' }],
        }),
      );
      expect(dayOf(result, '2026-10-05').workedMinutes).toBe(0);
      expect(codes(result, '2026-10-05')).toContain('INVALID_SPAN');
    }
  });

  it('credits saved time off at most the new target after a terms change', () => {
    // Leave saved on a Friday; later terms make Friday non-working.
    const fourDays = {
      ...defaultWorkTerms('2026-10-05'),
      targetMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: null, sat: null, sun: null },
      minimumMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: null, sat: null, sun: null },
    };
    const result = calculateHours({
      ...input('2026-10-05', '2026-10-10', {
        days: [
          ...['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) =>
            day(d, '08:00', '16:00', { breakMinutes: 30 }),
          ),
          day('2026-10-09', null, null, { leaveMinutes: m('7:30') }),
        ],
        conversions: ['2026-10-05'],
      }),
      terms: [fourDays],
    });
    expect(codes(result, '2026-10-09')).toContain('TIME_OFF_OVER_TARGET');
    expect(dayOf(result, '2026-10-09')).toMatchObject({ creditedMinutes: 0, rawFlexiMinutes: 0 });
    // The leave creates no excess, so no on-target day is levelled.
    expect(result.weeks[0]).toMatchObject({ excessMinutes: 0, allocation: {} });
    // It still counts against the allowance.
    expect(result.leaveYears[0]!.usedMinutes).toBe(m('7:30'));
  });

  it('never levels on-target days for weekend leave (test review repro)', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-12', {
        days: [
          ...['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) =>
            day(d, '08:00', '16:00', { breakMinutes: 30 }),
          ),
          day('2026-10-09', '08:00', '15:30'),
          day('2026-10-10', null, null, { leaveMinutes: m('2:00') }),
        ],
        conversions: ['2026-10-05'],
      }),
    );
    expect(result.weeks[0]).toMatchObject({ excessMinutes: 0, allocation: {} });
    expect(dayOf(result, '2026-10-05')).toMatchObject({ convertedMinutes: 0, dayFlexiMinutes: 0 });
  });

  it('never throws for an excess that worked time cannot cover', () => {
    const result = calculateHours(
      input('2026-10-05', '2026-10-12', {
        days: [day('2026-10-10', null, null, { leaveMinutes: m('7:30') })],
        conversions: ['2026-10-05'],
      }),
    );
    // Saturday leave (non-working) with missing weekdays: net negative, so E = 0,
    // and the leave warns.
    expect(result.weeks[0]!.excessMinutes).toBe(0);
    expect(codes(result, '2026-10-10')).toContain('TIME_OFF_OVER_TARGET');
  });
});

describe('matrix gaps (test review)', () => {
  it.each([
    ['2026-10-19', '2026-10-24', m('9:00')],
    ['2027-03-22', '2027-03-27', m('7:00')],
    ['2027-10-25', '2027-10-30', m('9:00')],
  ])('keeps week totals right across the change in the week of %s', (monday, saturday, span) => {
    const sunday = `${saturday.slice(0, 8)}${String(Number(saturday.slice(8)) + 1).padStart(2, '0')}`;
    const result = calculateHours(
      input(monday, sunday, {
        days: [...neutralDays(monday, saturday), day(saturday, '22:00', '06:00')],
      }),
    );
    const [week] = summarise(
      result,
      monday,
      `${sunday.slice(0, 8)}${String(Number(sunday.slice(8)) + 1).padStart(2, '0')}`,
      'week',
    );
    expect(week).toMatchObject({
      workedMinutes: m('37:30') + span - 30,
      rawFlexiMinutes: span - 30,
      flexiMinutes: span - 30,
    });
  });

  it('caps bank holiday credit at the maximum leave per day, below a larger target', () => {
    const result = calculateHours(
      input(
        '2026-12-21',
        '2026-12-30',
        { publicHolidays: ['2026-12-25'] },
        {
          targetMinutes: { mon: 480, tue: 480, wed: 480, thu: 480, fri: 480, sat: null, sun: null },
          minimumMinutes: {
            mon: 480,
            tue: 480,
            wed: 480,
            thu: 480,
            fri: 330,
            sat: null,
            sun: null,
          },
        },
      ),
    );
    expect(dayOf(result, '2026-12-25')).toMatchObject({
      bankHolidayMinutes: m('7:30'),
      rawFlexiMinutes: m('-0:30'),
    });
  });

  it('does not warn when the balance only reaches a cap', () => {
    // Monday +1:30 then Tuesday +2:30 = +4:00: a credit cap of exactly 4:00 is not crossed.
    const atCredit = calculateHours(
      input(
        '2026-10-05',
        '2026-10-07',
        { days: exampleWeek.slice(0, 2) },
        { flexiCreditCapMinutes: m('4:00') },
      ),
    );
    expect(atCredit.days.flatMap((d) => d.warnings).map((w) => w.code)).not.toContain(
      'FLEXI_CREDIT_CAP',
    );
    // Two missing days = −15:00: a debit cap of exactly 15:00 is not crossed.
    const atDebit = calculateHours(
      input('2026-10-05', '2026-10-07', {}, { flexiDebitCapMinutes: m('15:00') }),
    );
    expect(atDebit.days.flatMap((d) => d.warnings).map((w) => w.code)).not.toContain(
      'FLEXI_DEBIT_CAP',
    );
  });
});
