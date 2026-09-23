import type { IsoDate } from '../core/time/index.js';

import type { WorkTerms } from './types.js';

/** 7:30, the daily target, TOIL cap and maximum leave per day. */
export const STANDARD_DAY_MINUTES = 450;
/** The default yearly leave allowance, 247:30 (bank holidays included). */
export const DEFAULT_LEAVE_ALLOWANCE_MINUTES = 14_850;
/** Bought leave adds five standard days, 37:30. */
export const BOUGHT_LEAVE_MINUTES = 2_250;

/** The owner's defaults (feature doc → Data model), from a given Monday. */
export function defaultWorkTerms(effectiveFrom: IsoDate): WorkTerms {
  return {
    effectiveFrom,
    targetMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 450, sat: null, sun: null },
    minimumMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 330, sat: null, sun: null },
    breakThresholdMinutes: 360,
    breakMinimumMinutes: 30,
    bandStartMinutes: 7 * 60,
    bandEndMinutes: 19 * 60,
    paidOvertimeAllowed: false,
    toilMonthlyCapMinutes: STANDARD_DAY_MINUTES,
    leaveDayMaxMinutes: STANDARD_DAY_MINUTES,
    flexiCreditCapMinutes: null,
    flexiDebitCapMinutes: null,
  };
}
