import { defaultWorkTerms, formatDuration, formatTimeOfDay } from '@repo/domain';
import {
  BALANCE_CAP_MAX_MINUTES,
  HOURS_YEAR_MAX,
  HOURS_YEAR_MIN,
  LARGE_MINUTES_MAX,
  MINUTES_PER_DAY,
  NO_CONTROL_CHARACTERS_PATTERN,
  PUBLIC_HOLIDAY_NAME_MAX_LENGTH,
  TIME_ADJUSTMENT_BALANCES,
  TIME_ADJUSTMENT_REASONS,
  WEEKDAYS,
  type Weekday,
} from '@repo/types';
import { z } from 'zod';

import type { WorkTerm } from '../api/keys';

import {
  durationText,
  hoursDate,
  mondayDate,
  optionalDuration,
  requiredDuration,
  signedDuration,
  timeOfDay,
} from './fields';

/**
 * The hours settings forms (ADR-0007). Field names match the API's bodies, so a
 * parsed form is the request body. Every bound is a `@repo/types` constant, the
 * same one the API's DTOs and the database's CHECKs use (ADR-0017).
 */

function weekdayFields<T extends z.ZodType>(field: () => T) {
  return z.object({
    mon: field(),
    tue: field(),
    wed: field(),
    thu: field(),
    fri: field(),
    sat: field(),
    sun: field(),
  });
}

/** Terms: the per-weekday grid, the break rule, the band, overtime and the caps. */
export const workTermsFormSchema = z
  .object({
    effectiveFrom: mondayDate,
    // A target of at least 1 minute; clearing it makes the day non-working.
    targetMinutes: weekdayFields(() => optionalDuration({ min: 1, max: MINUTES_PER_DAY })),
    minimumMinutes: weekdayFields(() => optionalDuration({ max: MINUTES_PER_DAY })),
    breakThresholdMinutes: requiredDuration({ max: MINUTES_PER_DAY }),
    breakMinimumMinutes: requiredDuration({ max: MINUTES_PER_DAY }),
    bandStart: timeOfDay,
    bandEnd: timeOfDay,
    paidOvertimeAllowed: z.boolean(),
    toilMonthlyCapMinutes: requiredDuration({ max: BALANCE_CAP_MAX_MINUTES }),
    leaveDayMaxMinutes: requiredDuration({ max: MINUTES_PER_DAY }),
    flexiCreditCapMinutes: optionalDuration({ max: BALANCE_CAP_MAX_MINUTES }),
    flexiDebitCapMinutes: optionalDuration({ max: BALANCE_CAP_MAX_MINUTES }),
  })
  .superRefine((terms, ctx) => {
    for (const day of WEEKDAYS) {
      const target = terms.targetMinutes[day];
      const minimum = terms.minimumMinutes[day];
      if (minimum === null) continue;
      if (target === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['minimumMinutes', day],
          message: 'Clear the minimum, or set a flexi target for this day.',
        });
      } else if (minimum > target) {
        ctx.addIssue({
          code: 'custom',
          path: ['minimumMinutes', day],
          message: `Use at most the flexi target, ${formatDuration(target)}.`,
        });
      }
    }
    if (terms.bandEnd <= terms.bandStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['bandEnd'],
        message: 'End the working band after it starts.',
      });
    }
  });

export type WorkTermsFormValues = z.input<typeof workTermsFormSchema>;
export type WorkTermsFormOutput = z.output<typeof workTermsFormSchema>;

/** The form's text for a set of terms: saved ones, or the owner's defaults. */
export function workTermsFormValues(
  effectiveFrom: string,
  terms: Omit<
    WorkTerm,
    'id' | 'ownerId' | 'effectiveFrom' | 'version' | 'createdAt' | 'updatedAt'
  > | null,
): WorkTermsFormValues {
  const source = terms ?? apiShapeOf(effectiveFrom);
  const perDay = (values: Record<Weekday, number | null>) =>
    Object.fromEntries(WEEKDAYS.map((day) => [day, durationText(values[day])])) as Record<
      Weekday,
      string
    >;
  return {
    effectiveFrom,
    targetMinutes: perDay(source.targetMinutes),
    minimumMinutes: perDay(source.minimumMinutes),
    breakThresholdMinutes: durationText(source.breakThresholdMinutes),
    breakMinimumMinutes: durationText(source.breakMinimumMinutes),
    bandStart: source.bandStart,
    bandEnd: source.bandEnd,
    paidOvertimeAllowed: source.paidOvertimeAllowed,
    toilMonthlyCapMinutes: durationText(source.toilMonthlyCapMinutes),
    leaveDayMaxMinutes: durationText(source.leaveDayMaxMinutes),
    flexiCreditCapMinutes: durationText(source.flexiCreditCapMinutes),
    flexiDebitCapMinutes: durationText(source.flexiDebitCapMinutes),
  };
}

/** The engine's defaults in the API's shape (the band as `HH:MM`). */
function apiShapeOf(effectiveFrom: string) {
  const { bandStartMinutes, bandEndMinutes, ...rest } = defaultWorkTerms(effectiveFrom);
  return {
    ...rest,
    bandStart: formatTimeOfDay(bandStartMinutes),
    bandEnd: formatTimeOfDay(bandEndMinutes),
  };
}

const year = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Enter a year, such as 2026.')
  .transform(Number)
  .refine(
    (value) => value >= HOURS_YEAR_MIN && value <= HOURS_YEAR_MAX,
    `Enter a year from ${String(HOURS_YEAR_MIN)} to ${String(HOURS_YEAR_MAX)}.`,
  );

/** A new leave year: the year, its allowance and bought leave. */
export const leaveYearFormSchema = z.object({
  year,
  allowanceMinutes: requiredDuration({ max: LARGE_MINUTES_MAX }),
  boughtLeave: z.boolean(),
});

export type LeaveYearFormValues = z.input<typeof leaveYearFormSchema>;
export type LeaveYearFormOutput = z.output<typeof leaveYearFormSchema>;

/** Changing a year's allowance. */
export const leaveAllowanceFormSchema = z.object({
  allowanceMinutes: requiredDuration({ max: LARGE_MINUTES_MAX }),
});

export type LeaveAllowanceFormValues = z.input<typeof leaveAllowanceFormSchema>;
export type LeaveAllowanceFormOutput = z.output<typeof leaveAllowanceFormSchema>;

/** An opening balance, a confirmed forfeit or a correction. */
export const timeAdjustmentFormSchema = z.object({
  effectiveDate: hoursDate,
  balance: z.enum(TIME_ADJUSTMENT_BALANCES),
  reason: z.enum(TIME_ADJUSTMENT_REASONS),
  minutes: signedDuration(LARGE_MINUTES_MAX),
});

export type TimeAdjustmentFormValues = z.input<typeof timeAdjustmentFormSchema>;
export type TimeAdjustmentFormOutput = z.output<typeof timeAdjustmentFormSchema>;

/** A public holiday added by hand. */
export const publicHolidayFormSchema = z.object({
  date: hoursDate,
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name, such as Christmas Day.')
    .max(
      PUBLIC_HOLIDAY_NAME_MAX_LENGTH,
      `Use at most ${String(PUBLIC_HOLIDAY_NAME_MAX_LENGTH)} characters.`,
    )
    .regex(NO_CONTROL_CHARACTERS_PATTERN, 'Use letters, numbers and punctuation only.'),
});

export type PublicHolidayFormValues = z.input<typeof publicHolidayFormSchema>;
export type PublicHolidayFormOutput = z.output<typeof publicHolidayFormSchema>;
