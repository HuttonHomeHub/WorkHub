import { describe, expect, it } from 'vitest';

import { parseSignedDuration } from './fields';
import {
  leaveYearFormSchema,
  publicHolidayFormSchema,
  timeAdjustmentFormSchema,
  workTermsFormSchema,
  workTermsFormValues,
  type WorkTermsFormValues,
} from './settings';

function defaults(overrides: Partial<WorkTermsFormValues> = {}): WorkTermsFormValues {
  return { ...workTermsFormValues('2026-10-05', null), ...overrides };
}

function messages(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  return Object.fromEntries(
    (result.error?.issues ?? []).map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('workTermsFormSchema', () => {
  it('turns the default form into the API body, in minutes', () => {
    const result = workTermsFormSchema.parse(defaults());
    expect(result).toEqual({
      effectiveFrom: '2026-10-05',
      targetMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 450, sat: null, sun: null },
      minimumMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 330, sat: null, sun: null },
      breakThresholdMinutes: 360,
      breakMinimumMinutes: 30,
      bandStart: '07:00',
      bandEnd: '19:00',
      paidOvertimeAllowed: false,
      toilMonthlyCapMinutes: 450,
      leaveDayMaxMinutes: 450,
      flexiCreditCapMinutes: null,
      flexiDebitCapMinutes: null,
    });
  });

  it('shows the defaults as h:mm text, with non-working days empty', () => {
    const values = defaults();
    expect(values.targetMinutes.mon).toBe('7:30');
    expect(values.minimumMinutes.fri).toBe('5:30');
    expect(values.targetMinutes.sat).toBe('');
    expect(values.breakThresholdMinutes).toBe('6:00');
  });

  it('accepts other duration forms and the band typed loosely', () => {
    const result = workTermsFormSchema.parse(
      defaults({ breakMinimumMinutes: '45m', bandStart: '730', flexiCreditCapMinutes: '15h' }),
    );
    expect(result.breakMinimumMinutes).toBe(45);
    expect(result.bandStart).toBe('07:30');
    expect(result.flexiCreditCapMinutes).toBe(900);
  });

  it('requires a Monday', () => {
    const result = workTermsFormSchema.safeParse(defaults({ effectiveFrom: '2026-10-06' }));
    expect(messages(result).effectiveFrom).toBe('Choose a Monday: terms start with a week.');
  });

  it('refuses a minimum on a day without a target, and one above its target', () => {
    const base = defaults();
    const result = workTermsFormSchema.safeParse({
      ...base,
      targetMinutes: { ...base.targetMinutes, mon: '', tue: '6:00' },
      minimumMinutes: { ...base.minimumMinutes, mon: '7:30', tue: '7:30' },
    });
    expect(messages(result)).toMatchObject({
      'minimumMinutes.mon': 'Clear the minimum, or set a flexi target for this day.',
      'minimumMinutes.tue': 'Use at most the flexi target, 6:00.',
    });
  });

  it('refuses a zero target (clear it instead) and a day over 24:00', () => {
    const base = defaults();
    const result = workTermsFormSchema.safeParse({
      ...base,
      targetMinutes: { ...base.targetMinutes, mon: '0:00', tue: '24:01' },
      minimumMinutes: { ...base.minimumMinutes, mon: '', tue: '' },
    });
    expect(messages(result)).toMatchObject({
      'targetMinutes.mon': 'Enter more than 0:00.',
      'targetMinutes.tue': 'Enter at most 24:00.',
    });
  });

  it('refuses a band that ends before it starts, and unreadable text', () => {
    const result = workTermsFormSchema.safeParse(
      defaults({ bandStart: '19:00', bandEnd: '07:00', toilMonthlyCapMinutes: 'lots' }),
    );
    expect(messages(result)).toMatchObject({
      toilMonthlyCapMinutes: 'Enter hours and minutes, such as 7:30.',
    });
    const band = workTermsFormSchema.safeParse(defaults({ bandStart: '19:00', bandEnd: '07:00' }));
    expect(messages(band).bandEnd).toBe('End the working band after it starts.');
  });

  it('caps a balance cap at a week (168:00)', () => {
    const result = workTermsFormSchema.safeParse(defaults({ flexiDebitCapMinutes: '168:01' }));
    expect(messages(result).flexiDebitCapMinutes).toBe('Enter at most 168:00.');
  });
});

describe('leaveYearFormSchema', () => {
  it('parses a year, an allowance and bought leave', () => {
    expect(
      leaveYearFormSchema.parse({ year: '2026', allowanceMinutes: '247:30', boughtLeave: true }),
    ).toEqual({ year: 2026, allowanceMinutes: 14_850, boughtLeave: true });
  });

  it('keeps the year within 2000–2100', () => {
    const result = leaveYearFormSchema.safeParse({
      year: '2101',
      allowanceMinutes: '247:30',
      boughtLeave: false,
    });
    expect(messages(result).year).toBe('Enter a year from 2000 to 2100.');
  });
});

describe('timeAdjustmentFormSchema', () => {
  it('takes a signed amount', () => {
    expect(
      timeAdjustmentFormSchema.parse({
        effectiveDate: '2026-10-05',
        balance: 'FLEXI',
        reason: 'FORFEIT',
        minutes: '−2:00',
      }).minutes,
    ).toBe(-120);
  });

  it('refuses zero', () => {
    const result = timeAdjustmentFormSchema.safeParse({
      effectiveDate: '2026-10-05',
      balance: 'TOIL',
      reason: 'OPENING_BALANCE',
      minutes: '0:00',
    });
    expect(messages(result).minutes).toBe('Enter an amount other than 0:00.');
  });
});

describe('publicHolidayFormSchema', () => {
  it('trims the name and refuses control characters', () => {
    expect(
      publicHolidayFormSchema.parse({ date: '2026-12-25', name: ' Christmas Day ' }).name,
    ).toBe('Christmas Day');
    const result = publicHolidayFormSchema.safeParse({ date: '2026-12-25', name: 'Bad\u0000name' });
    expect(messages(result).name).toBe('Use letters, numbers and punctuation only.');
  });

  it('refuses an impossible date', () => {
    const result = publicHolidayFormSchema.safeParse({ date: '2026-02-30', name: 'Nope' });
    expect(messages(result).date).toBe('Enter a date between 2000 and 2100.');
  });
});

describe('parseSignedDuration', () => {
  it.each([
    ['−2:00', -120],
    ['-30m', -30],
    ['+1:15', 75],
    ['7.5h', 450],
    ['nonsense', null],
  ])('reads %s as %s', (text, minutes) => {
    expect(parseSignedDuration(text)).toBe(minutes);
  });
});
