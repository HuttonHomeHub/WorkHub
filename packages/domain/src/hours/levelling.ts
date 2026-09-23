import type { IsoDate } from '../core/time/index.js';

export interface LevellingDay {
  date: IsoDate;
  workedMinutes: number;
  /** 0 on a non-working day. */
  targetMinutes: number;
}

/**
 * Rule 6's allocation: take the week's excess one minute at a time from the day
 * with the largest remaining surplus (worked − target), the latest date first
 * on a tie. A day never gives more than its worked minutes. The result equals
 * levelling the highest days down to a common line.
 *
 * Returns the minutes taken per date (dates that give nothing are omitted).
 * Throws if the days cannot cover the excess, which rule 4's cap on time off
 * rules out for valid input.
 */
export function levelExcess(
  excessMinutes: number,
  days: readonly LevellingDay[],
): Record<IsoDate, number> {
  const pool = days
    .filter((day) => day.workedMinutes > 0)
    .map((day) => ({
      date: day.date,
      surplus: day.workedMinutes - day.targetMinutes,
      room: day.workedMinutes,
      given: 0,
    }));
  for (let left = excessMinutes; left > 0; left--) {
    let pick: (typeof pool)[number] | undefined;
    for (const day of pool) {
      if (day.given >= day.room) continue;
      const remaining = day.surplus - day.given;
      const best = pick ? pick.surplus - pick.given : -Infinity;
      if (!pick || remaining > best || (remaining === best && day.date > pick.date)) pick = day;
    }
    if (!pick) throw new RangeError(`Cannot allocate ${left} more minutes: no worked time left`);
    pick.given++;
  }
  const out: Record<IsoDate, number> = {};
  for (const day of pool) if (day.given > 0) out[day.date] = day.given;
  return out;
}
