import { formatDuration, type HoursResult, recalculation } from '@repo/domain';

import type { SummaryGroup } from './api/keys';

import { formatDate } from '@/lib/format';

const total = (byMonth: Record<string, number>): number =>
  Object.values(byMonth).reduce((sum, minutes) => sum + minutes, 0);

/** "September", or "September and October". */
function monthNames(months: readonly string[]): string {
  const names = months.map((month) => formatDate(`${month}-01`, 'month'));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/** A week's conversion before and after an edit: TOIL and overtime (paid and unpaid). */
interface ConversionChange {
  toil: readonly [number, number];
  overtime: readonly [number, number];
}

/** Rule 11's wording, from what changed; `null` when nothing did. */
function message(
  weekStart: string,
  week: ConversionChange | null,
  closedMonthsChanged: readonly string[],
): string | null {
  if (!week && closedMonthsChanged.length === 0) return null;
  const parts: string[] = [];
  if (week) {
    const figures = [
      `TOIL ${formatDuration(week.toil[0])} → ${formatDuration(week.toil[1])}`,
      `overtime ${formatDuration(week.overtime[0])} → ${formatDuration(week.overtime[1])}`,
    ];
    parts.push(`Week of ${formatDate(weekStart, 'dayMonth')} recalculated: ${figures.join(', ')}`);
  } else {
    parts.push(`Week of ${formatDate(weekStart, 'dayMonth')} recalculated`);
  }
  if (closedMonthsChanged.length > 0) {
    parts.push(`${monthNames(closedMonthsChanged)} totals changed`);
  }
  return `${parts.join('. ')}.`;
}

/**
 * Rule 11's message for an edit to a day, from the engine's results before and
 * after it: "Week of 28 Sep recalculated: TOIL 1:00 → 0:40, overtime 2:00 →
 * 1:40", plus "September totals changed" when a month that has already ended
 * moved. `null` when the edit changed neither the week's conversion nor an
 * ended month (an ordinary edit says nothing more than "Saved").
 */
export function recalculationMessage(
  before: HoursResult,
  after: HoursResult,
  weekStart: string,
): string | null {
  const change = recalculation(before, after, weekStart);
  const week: ConversionChange | null = change.changed
    ? {
        toil: [total(change.before.toilByMonth), total(change.after.toilByMonth)],
        overtime: [total(change.before.overtimeByMonth), total(change.after.overtimeByMonth)],
      }
    : null;
  return message(weekStart, week, change.closedMonthsChanged);
}

/**
 * What `time-summaries` says about the edited week before or after a save: its
 * week group, and its month groups (the one or two months the week touches).
 */
export interface SummarySnapshot {
  week: SummaryGroup | undefined;
  months: readonly SummaryGroup[];
}

const conversionOf = (group: SummaryGroup) => ({
  toil: group.conversionToilMinutes ?? 0,
  overtime:
    (group.conversionOvertimePaidMinutes ?? 0) + (group.conversionOvertimeUnpaidMinutes ?? 0),
});

/** A month's totals that rule 11 reports on, as `recalculation()` compares them. */
const monthTotals = (group: SummaryGroup | undefined): string =>
  JSON.stringify(
    group && [
      group.toilMinutes,
      group.toilUnusedMinutes,
      group.overtimePaidMinutes + group.overtimeUnpaidMinutes,
      group.flexiMinutes,
    ],
  );

/**
 * Rule 11's message from the API's figures before and after a save, for the
 * week view, whose own engine run covers only the shown week and so cannot
 * see TOIL already converted earlier in the month. The week part appears when
 * the week's conversion is applied (a preview changes nothing yet) and its
 * TOIL or overtime moved; "September totals changed" when a month that ended
 * before `asOf` moved. The same wording as `recalculationMessage`.
 */
export function summaryRecalculationMessage(
  before: SummarySnapshot,
  after: SummarySnapshot,
  weekStart: string,
  asOf: string,
): string | null {
  let week: ConversionChange | null = null;
  if (
    before.week &&
    after.week &&
    (before.week.conversion === 'APPLIED' || after.week.conversion === 'APPLIED')
  ) {
    const b = conversionOf(before.week);
    const a = conversionOf(after.week);
    if (b.toil !== a.toil || b.overtime !== a.overtime) {
      week = { toil: [b.toil, a.toil], overtime: [b.overtime, a.overtime] };
    }
  }
  const closedMonthsChanged = after.months
    .filter((month) => month.end <= asOf)
    .filter(
      (month) => monthTotals(month) !== monthTotals(before.months.find((m) => m.key === month.key)),
    )
    .map((month) => month.key);
  return message(weekStart, week, closedMonthsChanged);
}
