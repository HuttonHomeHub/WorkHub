import {
  addDays,
  type ConversionState,
  DEFAULT_CONVERSION_BLOCK_MINUTES,
  type HoursResult,
} from '@repo/domain';

import type { SummaryGroup } from './api/keys';

/**
 * What the aside's "This week" panel shows: the week's `time-summaries` group
 * (saved data), with the week-local figures overlaid from the week view's own
 * engine run over saved and unsaved rows (`liveWeekFigures`), so the panel
 * follows the owner's typing before anything is saved.
 */
export interface ThisWeekFigures {
  targetMinutes: number;
  creditedMinutes: number;
  /** The week's flexi before conversion (Σ raw day flexi). */
  rawFlexiMinutes: number;
  conversion: ConversionState;
  /** The week's last working day; `null` when it has none. */
  settlementDate: string | null;
  /** E: the week's net positive flexi, which the switch converts. */
  excessMinutes: number;
  /** The conversion block in the week's terms (rule 6). */
  blockMinutes: number;
  /**
   * The whole blocks of E the conversion takes (preview or applied; 0 when
   * off). The rest of E stays as flexi.
   */
  convertedMinutes: number;
  /** The conversion's TOIL and overtime (a preview before settlement). */
  toilMinutes: number;
  overtimePaidMinutes: number;
  overtimeUnpaidMinutes: number;
}

/** The figures in a `time-summaries` week group (`groupBy=week`). */
export function figuresFromGroup(group: SummaryGroup): ThisWeekFigures {
  return {
    targetMinutes: group.targetMinutes,
    creditedMinutes: group.creditedMinutes,
    rawFlexiMinutes: group.rawFlexiMinutes,
    conversion: group.conversion ?? 'OFF',
    settlementDate: group.settlementDate ?? null,
    excessMinutes: group.excessMinutes ?? 0,
    blockMinutes: group.conversionBlockMinutes ?? DEFAULT_CONVERSION_BLOCK_MINUTES,
    convertedMinutes: group.conversionMinutes ?? 0,
    toilMinutes: group.conversionToilMinutes ?? 0,
    overtimePaidMinutes: group.conversionOvertimePaidMinutes ?? 0,
    overtimeUnpaidMinutes: group.conversionOvertimeUnpaidMinutes ?? 0,
  };
}

/**
 * The figures the week view's own engine run can give the panel: the ones
 * that depend only on the week's days (feature doc → Slice 7, "Live totals").
 * The week view computes one week with no history, so its TOIL and overtime
 * split (which depends on the TOIL already converted earlier in the month),
 * and anything after it, must come from `time-summaries`.
 */
export type LiveWeekFigures = Pick<
  ThisWeekFigures,
  | 'targetMinutes'
  | 'creditedMinutes'
  | 'rawFlexiMinutes'
  | 'excessMinutes'
  | 'blockMinutes'
  | 'convertedMinutes'
>;

/**
 * The week's week-local figures from an engine result (`calculateWeek` in the
 * week view, over saved data plus unsaved rows), for `ThisWeekPanel`'s `live`
 * prop: credited against target, the week's raw flexi, its excess E and the
 * whole blocks of it that convert (so "After conversion" follows typing too). `null` when the result does not
 * cover the week.
 */
export function liveWeekFigures(result: HoursResult, weekStart: string): LiveWeekFigures | null {
  const week = result.weeks.find((w) => w.weekStart === weekStart);
  if (!week) return null;
  const end = addDays(weekStart, 7);
  let target = 0;
  let credited = 0;
  let rawFlexi = 0;
  for (const day of result.days) {
    if (day.date < weekStart || day.date >= end) continue;
    target += day.targetMinutes;
    credited += day.creditedMinutes;
    rawFlexi += day.rawFlexiMinutes;
  }
  return {
    targetMinutes: target,
    creditedMinutes: credited,
    rawFlexiMinutes: rawFlexi,
    excessMinutes: week.excessMinutes,
    blockMinutes: week.blockMinutes,
    convertedMinutes: week.convertedMinutes,
  };
}
