/**
 * Hours tracker rules shared by the web forms (Zod) and the API's DTOs, so
 * client and server validation cannot drift (ADR-0017). The database's CHECKs
 * (migration `add_hours_settings`) agree with every bound here.
 */

/** Minutes in a day: the most any per-day quantity may be. */
export const MINUTES_PER_DAY = 1440;

/** The most a balance cap (TOIL a month, flexi credit or debit) may be: a week. */
export const BALANCE_CAP_MAX_MINUTES = 10_080;

/** The most a leave allowance, or the size of a time adjustment, may be. */
export const LARGE_MINUTES_MAX = 100_000;

/** Leave years, and the years a date may fall in. */
export const HOURS_YEAR_MIN = 2000;
export const HOURS_YEAR_MAX = 2100;

/** Maximum length of a public holiday's name. */
export const PUBLIC_HOLIDAY_NAME_MAX_LENGTH = 100;

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const TIME_ADJUSTMENT_BALANCES = ['FLEXI', 'TOIL', 'LEAVE'] as const;
export type TimeAdjustmentBalance = (typeof TIME_ADJUSTMENT_BALANCES)[number];

export const TIME_ADJUSTMENT_REASONS = ['OPENING_BALANCE', 'FORFEIT', 'CORRECTION'] as const;
export type TimeAdjustmentReason = (typeof TIME_ADJUSTMENT_REASONS)[number];

/** `YYYY-MM-DD`. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** A 24-hour time of day, `HH:MM` (00:00–23:59). */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * True for a real calendar date in `YYYY-MM-DD` form within the hours years
 * (2000–2100); `2026-02-29` is false.
 */
export function isHoursDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < HOURS_YEAR_MIN || year > HOURS_YEAR_MAX) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** True when a valid `YYYY-MM-DD` date is a Monday (work terms start on one). */
export function isMonday(value: string): boolean {
  return isHoursDate(value) && new Date(`${value}T00:00:00Z`).getUTCDay() === 1;
}
