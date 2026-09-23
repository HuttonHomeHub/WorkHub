import {
  addDays,
  datesInRange,
  isIsoDate,
  londonDateAt,
  weekStartOf,
  yearOf,
  type IsoDate,
} from '@repo/domain';
import { HOURS_YEAR_MAX, HOURS_YEAR_MIN } from '@repo/types';

/**
 * The week the URL should show (`/hours?week=`): the Monday of a valid date in
 * the hours years, or of `today` when the value is missing or unreadable. A
 * Monday is returned unchanged, so a caller can redirect when the result
 * differs from what the URL says.
 */
export function normaliseWeek(week: string | undefined, today: IsoDate): IsoDate {
  if (week !== undefined && isIsoDate(week)) {
    const monday = weekStartOf(week);
    const year = yearOf(monday);
    // The week must lie wholly within the years the API and the engine accept.
    if (year >= HOURS_YEAR_MIN && yearOf(addDays(monday, 6)) <= HOURS_YEAR_MAX) return monday;
  }
  return weekStartOf(today);
}

/** The seven dates of the week starting `weekStart`, Monday first. */
export function weekDates(weekStart: IsoDate): IsoDate[] {
  return datesInRange(weekStart, addDays(weekStart, 7));
}

/** Whether the week before or after `weekStart` is still within the hours years. */
export function canMoveWeek(weekStart: IsoDate, by: -1 | 1): boolean {
  const target = addDays(weekStart, 7 * by);
  return yearOf(target) >= HOURS_YEAR_MIN && yearOf(addDays(target, 6)) <= HOURS_YEAR_MAX;
}

/** Today's date in Europe/London, from the browser's clock. */
export function todayInLondon(): IsoDate {
  return londonDateAt(new Date());
}
