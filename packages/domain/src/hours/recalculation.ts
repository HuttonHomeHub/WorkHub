import { addDays, type IsoDate, monthOf } from '../core/time/index.js';

import type { HoursResult } from './types.js';

/** A week's conversion figures, by the month each allocated date falls in. */
export interface WeekFigures {
  excessMinutes: number;
  toilByMonth: Record<string, number>;
  overtimeByMonth: Record<string, number>;
}

export interface Recalculation {
  weekStart: IsoDate;
  before: WeekFigures;
  after: WeekFigures;
  /** Whether the week's excess, TOIL or overtime changed. */
  changed: boolean;
  /** Ended months (`YYYY-MM`) the week touches whose totals changed. */
  closedMonthsChanged: string[];
}

function weekFigures(result: HoursResult, weekStart: IsoDate): WeekFigures {
  const end = addDays(weekStart, 7);
  const week = result.weeks.find((w) => w.weekStart === weekStart);
  const figures: WeekFigures = {
    excessMinutes: week?.excessMinutes ?? 0,
    toilByMonth: {},
    overtimeByMonth: {},
  };
  for (const day of result.days) {
    if (day.date < weekStart || day.date >= end || day.convertedMinutes === 0) continue;
    const month = monthOf(day.date);
    figures.toilByMonth[month] = (figures.toilByMonth[month] ?? 0) + day.toilMinutes;
    figures.overtimeByMonth[month] =
      (figures.overtimeByMonth[month] ?? 0) + day.convertedMinutes - day.toilMinutes;
  }
  return figures;
}

function monthTotals(result: HoursResult, month: string): string {
  const m = result.months.find((x) => x.month === month);
  let overtime = 0;
  let flexi = 0;
  for (const day of result.days) {
    if (monthOf(day.date) !== month) continue;
    overtime += day.overtimePaidMinutes + day.overtimeUnpaidMinutes;
    flexi += day.dayFlexiMinutes - day.flexiDebitMinutes;
  }
  return JSON.stringify([
    m?.toilMinutes,
    m?.toilUnusedMinutes,
    m?.flexiDebitMinutes,
    overtime,
    flexi,
  ]);
}

const same = (a: WeekFigures, b: WeekFigures) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Rule 11: what an edit changed for its week — the before and after excess,
 * TOIL and overtime per month — and which already-ended months' totals moved,
 * for "Week of 28 Sep recalculated: TOIL 1:00 → 0:40" and "September totals
 * changed".
 */
export function recalculation(
  before: HoursResult,
  after: HoursResult,
  weekStart: IsoDate,
): Recalculation {
  const b = weekFigures(before, weekStart);
  const a = weekFigures(after, weekStart);
  const months = [...new Set([0, 6].map((offset) => monthOf(addDays(weekStart, offset))))];
  const closedMonthsChanged = months.filter(
    (month) =>
      after.months.find((m) => m.month === month)?.ended &&
      monthTotals(before, month) !== monthTotals(after, month),
  );
  return { weekStart, before: b, after: a, changed: !same(a, b), closedMonthsChanged };
}
