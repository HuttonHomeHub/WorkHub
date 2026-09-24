import type { IsoDate, IsoInstant } from '../core/time/index.js';

/**
 * Inputs and outputs of the hours engine (docs/features/hours-tracker.md →
 * Calculation rules). Every duration is whole minutes. Inputs are the owner's
 * active rows as the API returns them; nothing derived is ever an input.
 */

/** Per-weekday values, Monday first. `null` means "not set". */
export interface Weekdays<T> {
  mon: T;
  tue: T;
  wed: T;
  thu: T;
  fri: T;
  sat: T;
  sun: T;
}

export const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** Effective-dated settings (the `work_terms` table). */
export interface WorkTerms {
  /** Always a Monday; the earliest is the tracking start. */
  effectiveFrom: IsoDate;
  /** The flexi target per weekday; `null` makes the day non-working. */
  targetMinutes: Weekdays<number | null>;
  /** The warning-only minimum per weekday. */
  minimumMinutes: Weekdays<number | null>;
  breakThresholdMinutes: number;
  breakMinimumMinutes: number;
  /** Working band, minutes after midnight. */
  bandStartMinutes: number;
  bandEndMinutes: number;
  paidOvertimeAllowed: boolean;
  toilMonthlyCapMinutes: number;
  /**
   * Rule 6: conversion turns whole blocks of this many minutes into TOIL and
   * overtime; the rest of the week's excess stays as flexi.
   */
  conversionBlockMinutes: number;
  leaveDayMaxMinutes: number;
  flexiCreditCapMinutes: number | null;
  flexiDebitCapMinutes: number | null;
}

/** One `work_days` row. */
export interface WorkDayRow {
  date: IsoDate;
  startsAt: IsoInstant | null;
  endsAt: IsoInstant | null;
  breakMinutes: number;
  leaveMinutes: number;
  toilTakenMinutes: number;
  bankHolidayWorked: boolean;
}

export type AdjustmentBalance = 'FLEXI' | 'TOIL' | 'LEAVE';

/** A signed, dated correction (`time_adjustments`). */
export interface TimeAdjustment {
  effectiveDate: IsoDate;
  balance: AdjustmentBalance;
  minutes: number;
}

/** A `leave_years` row; a year without one uses the default allowance. */
export interface LeaveYearSetting {
  year: number;
  allowanceMinutes: number;
  boughtLeave: boolean;
}

export interface HoursInput {
  /** Active terms, any order. With none, nothing is tracked. */
  terms: WorkTerms[];
  days: WorkDayRow[];
  /** Week starts (Mondays) whose conversion switch is on. */
  conversions: IsoDate[];
  /** England and Wales bank holidays. */
  publicHolidays: IsoDate[];
  adjustments: TimeAdjustment[];
  leaveYears: LeaveYearSetting[];
  /** Today in Europe/London, from the caller; the engine never reads "now". */
  asOf: IsoDate;
}

export type WarningCode =
  | 'BELOW_MINIMUM'
  | 'OUTSIDE_BAND'
  | 'MISSING_DAY'
  | 'FLEXI_CREDIT_CAP'
  | 'FLEXI_DEBIT_CAP'
  | 'TOIL_UNUSED'
  | 'TOIL_NOT_EARNED'
  | 'LEAVE_OVER_ALLOWANCE'
  | 'BREAK_RAISED'
  | 'INVALID_SPAN'
  | 'TIME_OFF_OVER_TARGET';

/** Warnings never change a number (rule 13). `BREAK_RAISED` is a note. */
export interface HoursWarning {
  code: WarningCode;
  date: IsoDate;
}

export type ConversionState = 'OFF' | 'PREVIEW' | 'APPLIED';

/** One date's figures. Month-end effects are dated the month's last day. */
export interface DayResult {
  date: IsoDate;
  /** Whether terms are in force (on or after the tracking start). */
  tracked: boolean;
  working: boolean;
  targetMinutes: number;
  minimumMinutes: number | null;
  hasRow: boolean;
  /** Rule 5: past, or today with a row. */
  counted: boolean;
  spanMinutes: number;
  breakRecordedMinutes: number;
  breakDeductedMinutes: number;
  workedMinutes: number;
  leaveMinutes: number;
  toilTakenMinutes: number;
  bankHoliday: boolean;
  bankHolidayMinutes: number;
  creditedMinutes: number;
  rawFlexiMinutes: number;
  /** Converted by an applied week conversion. */
  convertedMinutes: number;
  /** Raw flexi less converted minutes. */
  dayFlexiMinutes: number;
  /** Rule 8's flexi debit (TOIL taken but not earned), on the month's last day. */
  flexiDebitMinutes: number;
  toilMinutes: number;
  /** Rule 8's unused TOIL turned into overtime, on the month's last day. */
  toilUnusedMinutes: number;
  overtimePaidMinutes: number;
  overtimeUnpaidMinutes: number;
  /** Flexi balance at the end of the day, adjustments included. */
  flexiBalanceMinutes: number;
  /** A preview allocation, before the week's settlement (changes no balance). */
  previewConvertedMinutes: number;
  warnings: HoursWarning[];
}

export interface WeekResult {
  weekStart: IsoDate;
  /** The week's last working day; `null` when it has none. */
  settlementDate: IsoDate | null;
  conversion: ConversionState;
  /** E: the week's net positive flexi over counted days. */
  excessMinutes: number;
  /** The conversion block in force for the week (terms never change mid-week). */
  blockMinutes: number;
  /**
   * The minutes the conversion takes from E (applied or preview): whole
   * blocks, 0 when the switch is off. The rest of E stays as flexi.
   */
  convertedMinutes: number;
  /** Per-date allocation of the converted minutes (applied or preview). */
  allocation: Record<IsoDate, number>;
  toilMinutes: number;
  overtimePaidMinutes: number;
  overtimeUnpaidMinutes: number;
}

export interface MonthResult {
  month: string;
  ended: boolean;
  toilCapMinutes: number;
  toilMinutes: number;
  toilTakenMinutes: number;
  toilUnusedMinutes: number;
  flexiDebitMinutes: number;
}

export interface LeaveYearResult {
  year: number;
  allowanceMinutes: number;
  usedMinutes: number;
  remainingMinutes: number;
}

export interface HoursResult {
  asOf: IsoDate;
  trackingStart: IsoDate | null;
  days: DayResult[];
  weeks: WeekResult[];
  months: MonthResult[];
  leaveYears: LeaveYearResult[];
}
