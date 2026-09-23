import { formatDuration, type HoursResult, recalculation } from '@repo/domain';

import { formatDate } from '@/lib/format';

const total = (byMonth: Record<string, number>): number =>
  Object.values(byMonth).reduce((sum, minutes) => sum + minutes, 0);

/** "September", or "September and October". */
function monthNames(months: readonly string[]): string {
  const names = months.map((month) => formatDate(`${month}-01`, 'month'));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
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
  if (!change.changed && change.closedMonthsChanged.length === 0) return null;

  const parts: string[] = [];
  if (change.changed) {
    const toil = [total(change.before.toilByMonth), total(change.after.toilByMonth)];
    const overtime = [total(change.before.overtimeByMonth), total(change.after.overtimeByMonth)];
    const figures = [
      `TOIL ${formatDuration(toil[0] ?? 0)} → ${formatDuration(toil[1] ?? 0)}`,
      `overtime ${formatDuration(overtime[0] ?? 0)} → ${formatDuration(overtime[1] ?? 0)}`,
    ];
    parts.push(`Week of ${formatDate(weekStart, 'dayMonth')} recalculated: ${figures.join(', ')}`);
  } else {
    parts.push(`Week of ${formatDate(weekStart, 'dayMonth')} recalculated`);
  }
  if (change.closedMonthsChanged.length > 0) {
    parts.push(`${monthNames(change.closedMonthsChanged)} totals changed`);
  }
  return `${parts.join('. ')}.`;
}
