import {
  addDays,
  calculateHours,
  formatDuration,
  formatTimeOfDay,
  localDateOf,
  localMinutesOf,
  parseTimeOfDay,
  sortTerms,
  termsFor,
  type DayResult,
  type HoursResult,
  type IsoDate,
  type WeekResult,
  type WorkDayRow,
  type WorkTerms,
} from '@repo/domain';

import type { WorkTerm } from '../api/keys';

/** API work terms → the engine's (the band from `HH:MM` to minutes after midnight). */
export function toEngineTerms(row: WorkTerm): WorkTerms {
  return {
    effectiveFrom: row.effectiveFrom,
    targetMinutes: row.targetMinutes,
    minimumMinutes: row.minimumMinutes,
    breakThresholdMinutes: row.breakThresholdMinutes,
    breakMinimumMinutes: row.breakMinimumMinutes,
    bandStartMinutes: parseTimeOfDay(row.bandStart) ?? 0,
    bandEndMinutes: parseTimeOfDay(row.bandEnd) ?? 24 * 60 - 1,
    paidOvertimeAllowed: row.paidOvertimeAllowed,
    toilMonthlyCapMinutes: row.toilMonthlyCapMinutes,
    conversionBlockMinutes: row.conversionBlockMinutes,
    leaveDayMaxMinutes: row.leaveDayMaxMinutes,
    flexiCreditCapMinutes: row.flexiCreditCapMinutes,
    flexiDebitCapMinutes: row.flexiDebitCapMinutes,
  };
}

export interface WeekCalculationInput {
  weekStart: IsoDate;
  /** Every active set of terms, any order. */
  terms: readonly WorkTerms[];
  /** The week's rows: saved, with any readable unsaved row in place of its saved one. */
  days: readonly WorkDayRow[];
  /** Whether the week's conversion switch is on. */
  converting: boolean;
  /** Bank holidays (any range; only the week's matter). */
  publicHolidays: readonly IsoDate[];
  /** Today in Europe/London. */
  asOf: IsoDate;
}

export interface WeekCalculation {
  result: HoursResult;
  /** The week's seven days, Monday first. */
  days: DayResult[];
  week: WeekResult;
  /** The terms in force for the week (terms change only on a Monday). */
  terms: WorkTerms;
}

/**
 * Runs `calculateHours` for one week of the week view, or `null` when the
 * week is before the tracking start (or there are no terms).
 *
 * Everything the table shows is **week-local**: worked and credited time, day
 * flexi, the week's excess and its levelling (rules 3–6), and the per-day
 * warnings. None depends on earlier weeks, so the engine is given only the
 * week's rows and the terms in force for it, re-dated to the week's Monday.
 * The result for this week is identical to a run from the real tracking start
 * (a test proves it), and the engine covers days from this Monday to the end
 * of the year instead of from the tracking start. Balances, TOIL by month and
 * the history-dependent warnings (caps, month-end TOIL, the leave allowance)
 * are the aside's, read from the API.
 */
export function calculateWeek(input: WeekCalculationInput): WeekCalculation | null {
  const sorted = sortTerms(input.terms);
  const inForce = termsFor(sorted, input.weekStart);
  if (!inForce) return null;
  const weekEnd = addDays(input.weekStart, 7);
  const inWeek = (date: IsoDate) => date >= input.weekStart && date < weekEnd;
  const result = calculateHours(
    {
      // The week's terms from its Monday, plus any later terms (the rest of
      // the engine's range), so nothing earlier than the week is computed.
      terms: [
        { ...inForce, effectiveFrom: input.weekStart },
        ...sorted.filter((terms) => terms.effectiveFrom > input.weekStart),
      ],
      days: input.days.filter((day) => inWeek(day.date)),
      conversions: input.converting ? [input.weekStart] : [],
      publicHolidays: input.publicHolidays.filter(inWeek),
      adjustments: [],
      leaveYears: [],
      asOf: input.asOf,
    },
    { until: addDays(input.weekStart, 6) },
  );
  const days = result.days.filter((day) => inWeek(day.date));
  const week = result.weeks.find((candidate) => candidate.weekStart === input.weekStart);
  if (!week || days.length !== 7) return null;
  return { result, days, week, terms: inForce };
}

/** The week's totals for the table's footer. */
export function weekTotals(days: readonly DayResult[]) {
  return {
    creditedMinutes: days.reduce((sum, day) => sum + day.creditedMinutes, 0),
    targetMinutes: days.reduce((sum, day) => sum + day.targetMinutes, 0),
    flexiMinutes: days.reduce((sum, day) => sum + day.dayFlexiMinutes, 0),
    convertedMinutes: days.reduce((sum, day) => sum + day.convertedMinutes, 0),
    previewConvertedMinutes: days.reduce((sum, day) => sum + day.previewConvertedMinutes, 0),
  };
}

export interface RowWarning {
  /** A warning (⚠), or a note that explains a number. */
  kind: 'warning' | 'note';
  text: string;
}

/**
 * A day's warnings as the row shows them (rule 13), in words: "Below 5:30
 * minimum", "Before 07:00". Only the week-local codes are shown in the row;
 * balance warnings (flexi caps, month-end TOIL, the leave allowance) need the
 * whole history and belong to the aside.
 */
export function rowWarnings(
  day: DayResult,
  terms: WorkTerms,
  row: WorkDayRow | undefined,
): RowWarning[] {
  const out: RowWarning[] = [];
  for (const { code } of day.warnings) {
    switch (code) {
      case 'BELOW_MINIMUM':
        out.push({
          kind: 'warning',
          text: `Below ${formatDuration(day.minimumMinutes ?? 0)} minimum`,
        });
        break;
      case 'OUTSIDE_BAND': {
        if (!row?.startsAt || !row.endsAt) break;
        if (localMinutesOf(row.startsAt) < terms.bandStartMinutes) {
          out.push({ kind: 'warning', text: `Before ${formatTimeOfDay(terms.bandStartMinutes)}` });
        }
        if (
          localDateOf(row.endsAt) > day.date ||
          localMinutesOf(row.endsAt) > terms.bandEndMinutes
        ) {
          out.push({ kind: 'warning', text: `After ${formatTimeOfDay(terms.bandEndMinutes)}` });
        }
        break;
      }
      case 'MISSING_DAY':
        out.push({ kind: 'warning', text: 'Nothing recorded' });
        break;
      case 'TIME_OFF_OVER_TARGET':
        out.push({
          kind: 'warning',
          text: `Time off over the ${formatDuration(day.targetMinutes)} target`,
        });
        break;
      case 'INVALID_SPAN':
        out.push({ kind: 'warning', text: 'Times not valid' });
        break;
      case 'BREAK_RAISED':
        out.push({
          kind: 'note',
          text: `Break raised to ${formatDuration(day.breakDeductedMinutes)}`,
        });
        break;
      default:
        // Balance warnings: shown with the balances, not on a day.
        break;
    }
  }
  return out;
}
