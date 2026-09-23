/**
 * Conversions between the wire formats and Prisma's `Date` for `date` and
 * `time` columns. Prisma reads and writes both as UTC: a `date` is midnight UTC
 * on that day, and a `time(0)` is that wall-clock time on 1970-01-01 UTC. Never
 * apply a local zone here, or values shift by an hour in BST.
 */

/** `YYYY-MM-DD` → the `Date` Prisma stores in a `date` column. */
export function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** A `date` column's `Date` → `YYYY-MM-DD`. */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `HH:MM` → the `Date` Prisma stores in a `time(0)` column. */
export function toDbTime(time: string): Date {
  return new Date(`1970-01-01T${time}:00.000Z`);
}

/** A `time(0)` column's `Date` → `HH:MM`. */
export function fromDbTime(time: Date): string {
  return time.toISOString().slice(11, 16);
}

/** Minutes after midnight of a `time(0)` column's `Date`. */
export function dbTimeMinutes(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}
