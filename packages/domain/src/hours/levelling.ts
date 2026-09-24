import type { IsoDate } from '../core/time/index.js';

export interface LevellingDay {
  date: IsoDate;
  workedMinutes: number;
  /** 0 on a non-working day. */
  targetMinutes: number;
}

/**
 * Rule 6's allocation, in whole blocks (changed on 2026-09-23: the owner's
 * timesheet takes 30-minute blocks). The convertible minutes are the largest
 * whole number of blocks within `excessMinutes`; they are taken **one block
 * at a time** from the day with the largest remaining surplus (worked −
 * target), the latest date first on a tie. A day never gives more than its
 * worked minutes, so a block comes only from a day with at least a block of
 * worked minutes left; when no day has, allocation stops.
 *
 * Every day's share is a multiple of the block. Whatever is not allocated
 * (E less the allocation) stays as flexi on the days. With a block of one
 * minute this is the original minute-by-minute levelling.
 *
 * Returns the minutes taken per date (dates that give nothing are omitted).
 */
export function levelExcess(
  excessMinutes: number,
  days: readonly LevellingDay[],
  blockMinutes: number,
): Record<IsoDate, number> {
  if (!Number.isInteger(blockMinutes) || blockMinutes < 1) {
    throw new RangeError(`The conversion block must be a whole number of minutes ≥ 1`);
  }
  const pool = days
    .filter((day) => day.workedMinutes > 0)
    .map((day) => ({
      date: day.date,
      surplus: day.workedMinutes - day.targetMinutes,
      room: day.workedMinutes,
      given: 0,
    }));
  for (let blocks = Math.floor(excessMinutes / blockMinutes); blocks > 0; blocks--) {
    let pick: (typeof pool)[number] | undefined;
    for (const day of pool) {
      if (day.room - day.given < blockMinutes) continue;
      const remaining = day.surplus - day.given;
      const best = pick ? pick.surplus - pick.given : -Infinity;
      if (!pick || remaining > best || (remaining === best && day.date > pick.date)) pick = day;
    }
    if (!pick) break;
    pick.given += blockMinutes;
  }
  const out: Record<IsoDate, number> = {};
  for (const day of pool) if (day.given > 0) out[day.date] = day.given;
  return out;
}
