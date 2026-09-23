import type { WorkTerm } from '@prisma/client';
import { localDateOf, minutesBetween } from '@repo/domain';
import { MINUTES_PER_DAY } from '@repo/types';

/** A work day's values as the service is about to store them. */
export interface WorkDayValues {
  date: string;
  startsAt: string | null;
  endsAt: string | null;
  breakMinutes: number;
  leaveMinutes: number;
  toilTakenMinutes: number;
  bankHolidayWorked: boolean;
}

/** The neighbouring days' times, for the night-shift check. */
export interface Neighbours {
  previousEndsAt: string | null;
  nextStartsAt: string | null;
}

const COLUMN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** The flexi target for a date under these terms; `null` on a non-working day. */
export function targetFor(terms: WorkTerm, date: string): number | null {
  const weekday = COLUMN[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
  return terms[`targetMinutes${weekday}`];
}

/**
 * The rules a work day must meet before it is stored
 * (docs/features/hours-tracker.md → Calculation rules 3 and 4, Data model).
 * Returns the problems, empty when valid. Warnings (short days, the band) are
 * the engine's, never errors.
 */
export function workDayProblems(
  values: WorkDayValues,
  terms: WorkTerm | null,
  isBankHoliday: boolean,
  neighbours: Neighbours,
): string[] {
  if (!terms) return ['date is before your tracking start: set work terms from an earlier Monday'];

  const problems: string[] = [];
  const { startsAt, endsAt } = values;
  if (startsAt === null && endsAt === null && values.breakMinutes > 0) {
    problems.push('breakMinutes needs a start and end');
  } else if ((startsAt === null) !== (endsAt === null)) {
    problems.push('startsAt and endsAt must both be set, or both be empty');
  } else if (startsAt !== null && endsAt !== null) {
    const span = minutesBetween(startsAt, endsAt);
    if (span <= 0) problems.push('endsAt must be after startsAt');
    else if (span > MINUTES_PER_DAY) problems.push('a shift must be at most 24 hours');
    else if (values.breakMinutes >= span) problems.push('breakMinutes must be less than the shift');
    if (localDateOf(startsAt) !== values.date) {
      problems.push('startsAt must fall on date in Europe/London');
    }
    // A night shift counts wholly to its row, so it must end before the next
    // day's start, and start after the previous day's end.
    if (neighbours.nextStartsAt !== null && endsAt > neighbours.nextStartsAt) {
      problems.push("endsAt must not run into the next day's start");
    }
    if (neighbours.previousEndsAt !== null && startsAt < neighbours.previousEndsAt) {
      problems.push("startsAt must not be before the previous day's end");
    }
  }

  // Rule 4: leave, TOIL taken and bank holiday credit only on working days,
  // together at most the target; leave at most the maximum per day.
  const target = targetFor(terms, values.date);
  const timeOff = values.leaveMinutes + values.toilTakenMinutes;
  if (target === null) {
    if (timeOff > 0) problems.push('leave and TOIL taken are only allowed on working days');
  } else {
    if (values.leaveMinutes > terms.leaveDayMaxMinutes) {
      problems.push(
        `leaveMinutes must be at most ${terms.leaveDayMaxMinutes} (the maximum per day)`,
      );
    }
    const holidayCredit =
      isBankHoliday && !values.bankHolidayWorked ? Math.min(terms.leaveDayMaxMinutes, target) : 0;
    if (timeOff + holidayCredit > target) {
      problems.push(
        holidayCredit > 0
          ? 'leave and TOIL taken cannot be added to a bank holiday unless it was worked'
          : `leave and TOIL taken together must be at most the day's target (${target})`,
      );
    }
  }
  if (values.bankHolidayWorked && !isBankHoliday) {
    problems.push('bankHolidayWorked is only for a bank holiday');
  }
  return problems;
}
