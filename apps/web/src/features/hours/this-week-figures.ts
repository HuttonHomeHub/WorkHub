import { addDays, type ConversionState, type HoursResult } from '@repo/domain';

import type { SummaryGroup } from './api/keys';

/**
 * What the aside's "This week" panel shows. It comes from the week's
 * `time-summaries` group (saved data), or from the week view's own engine run
 * over saved and unsaved rows (`thisWeekFigures`), so the panel follows the
 * owner's typing before anything is saved.
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
    toilMinutes: group.conversionToilMinutes ?? 0,
    overtimePaidMinutes: group.conversionOvertimePaidMinutes ?? 0,
    overtimeUnpaidMinutes: group.conversionOvertimeUnpaidMinutes ?? 0,
  };
}

/**
 * The week's figures from an engine result (`calculateHours` in the browser,
 * over saved data plus unsaved rows), for `ThisWeekPanel`'s `live` prop.
 * `null` when the result does not cover the week.
 */
export function thisWeekFigures(result: HoursResult, weekStart: string): ThisWeekFigures | null {
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
    conversion: week.conversion,
    settlementDate: week.settlementDate,
    excessMinutes: week.excessMinutes,
    toilMinutes: week.toilMinutes,
    overtimePaidMinutes: week.overtimePaidMinutes,
    overtimeUnpaidMinutes: week.overtimeUnpaidMinutes,
  };
}
