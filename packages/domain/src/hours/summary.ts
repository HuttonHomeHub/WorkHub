import { type IsoDate, monthOf, weekStartOf, yearOf } from '../core/time/index.js';

import type { ConversionState, DayResult, HoursResult, HoursWarning } from './types.js';

export type GroupBy = 'day' | 'week' | 'month';

/** One row of `time-summaries` (feature doc → API). */
export interface SummaryGroup {
  /** The date, the week's Monday, or `YYYY-MM`. */
  key: string;
  targetMinutes: number;
  creditedMinutes: number;
  workedMinutes: number;
  leaveMinutes: number;
  bankHolidayMinutes: number;
  rawFlexiMinutes: number;
  convertedMinutes: number;
  /** Day flexi less month-end debits (adjustments are only in the balance). */
  flexiMinutes: number;
  toilMinutes: number;
  toilTakenMinutes: number;
  toilUnusedMinutes: number;
  overtimePaidMinutes: number;
  overtimeUnpaidMinutes: number;
  flexiBalanceEndMinutes: number;
  /** Week groups only. */
  conversion?: ConversionState;
  warnings: HoursWarning[];
}

function groupKey(date: IsoDate, groupBy: GroupBy): string {
  if (groupBy === 'week') return weekStartOf(date);
  if (groupBy === 'month') return monthOf(date);
  return date;
}

/**
 * Totals of the days in `[from, to)`, grouped by day, week or month. A group
 * holds only the days inside the range, so callers that want whole weeks or
 * months widen the range first (the API does, ADR-0020 §4).
 */
export function summarise(
  result: HoursResult,
  from: IsoDate,
  to: IsoDate,
  groupBy: GroupBy,
): SummaryGroup[] {
  const conversionOf = new Map(result.weeks.map((week) => [week.weekStart, week.conversion]));
  const groups = new Map<string, SummaryGroup>();
  for (const day of result.days) {
    if (day.date < from || day.date >= to) continue;
    const key = groupKey(day.date, groupBy);
    let group = groups.get(key);
    if (!group) {
      group = emptyGroup(key);
      if (groupBy === 'week') group.conversion = conversionOf.get(key) ?? 'OFF';
      groups.set(key, group);
    }
    addDay(group, day);
  }
  return [...groups.values()];
}

function emptyGroup(key: string): SummaryGroup {
  return {
    key,
    targetMinutes: 0,
    creditedMinutes: 0,
    workedMinutes: 0,
    leaveMinutes: 0,
    bankHolidayMinutes: 0,
    rawFlexiMinutes: 0,
    convertedMinutes: 0,
    flexiMinutes: 0,
    toilMinutes: 0,
    toilTakenMinutes: 0,
    toilUnusedMinutes: 0,
    overtimePaidMinutes: 0,
    overtimeUnpaidMinutes: 0,
    flexiBalanceEndMinutes: 0,
    warnings: [],
  };
}

function addDay(group: SummaryGroup, day: DayResult): void {
  group.targetMinutes += day.targetMinutes;
  group.creditedMinutes += day.creditedMinutes;
  group.workedMinutes += day.workedMinutes;
  group.leaveMinutes += day.leaveMinutes;
  group.bankHolidayMinutes += day.bankHolidayMinutes;
  group.rawFlexiMinutes += day.rawFlexiMinutes;
  group.convertedMinutes += day.convertedMinutes;
  group.flexiMinutes += day.dayFlexiMinutes - day.flexiDebitMinutes;
  group.toilMinutes += day.toilMinutes;
  group.toilTakenMinutes += day.toilTakenMinutes;
  group.toilUnusedMinutes += day.toilUnusedMinutes;
  group.overtimePaidMinutes += day.overtimePaidMinutes;
  group.overtimeUnpaidMinutes += day.overtimeUnpaidMinutes;
  group.flexiBalanceEndMinutes = day.flexiBalanceMinutes;
  group.warnings.push(...day.warnings);
}

/** `time-balances` (feature doc → API), as of a date. */
export interface Balances {
  flexiMinutes: number;
  toilMonthMinutes: number;
  toilTakenMonthMinutes: number;
  toilCapMinutes: number;
  leaveRemainingMinutes: number;
  overtimePaidYearMinutes: number;
  overtimeUnpaidYearMinutes: number;
}

/**
 * Balances at the end of `asOf` (normally the result's own `asOf`): flexi, the
 * month's TOIL, leave remaining in the year, and the year's overtime.
 */
export function balancesAt(result: HoursResult, asOf: IsoDate = result.asOf): Balances {
  const year = yearOf(asOf);
  const month = result.months.find((m) => m.month === monthOf(asOf));
  let flexi = 0;
  let paid = 0;
  let unpaid = 0;
  for (const day of result.days) {
    if (day.date > asOf) break;
    flexi = day.flexiBalanceMinutes;
    if (yearOf(day.date) === year) {
      paid += day.overtimePaidMinutes;
      unpaid += day.overtimeUnpaidMinutes;
    }
  }
  return {
    flexiMinutes: flexi,
    toilMonthMinutes: month?.toilMinutes ?? 0,
    toilTakenMonthMinutes: month?.toilTakenMinutes ?? 0,
    toilCapMinutes: month?.toilCapMinutes ?? 0,
    leaveRemainingMinutes: result.leaveYears.find((y) => y.year === year)?.remainingMinutes ?? 0,
    overtimePaidYearMinutes: paid,
    overtimeUnpaidYearMinutes: unpaid,
  };
}
