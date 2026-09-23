import { Temporal } from './temporal.js';

/**
 * Calendar and clock helpers for WorkHub's fixed zone, `Europe/London`
 * (docs/PRODUCT.md). Dates cross the package boundary as ISO strings
 * (`YYYY-MM-DD`) and instants as ISO strings with `Z`, the same shapes the API
 * uses, so callers never handle Temporal objects. Nothing here reads "now":
 * callers pass every date and instant.
 */
export const ZONE = 'Europe/London';

/** A calendar date, `YYYY-MM-DD`. ISO dates sort correctly as strings. */
export type IsoDate = string;

/** An instant, ISO 8601 with `Z` (e.g. `2026-10-05T07:00:00.000Z`). */
export type IsoInstant = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A short, safe excerpt of untrusted input for an error message. */
const excerpt = (value: string): string => JSON.stringify(value.slice(0, 32));

/** Parse a `YYYY-MM-DD` date; throws a `RangeError` for anything else. */
export function plainDate(date: IsoDate): Temporal.PlainDate {
  if (!ISO_DATE.test(date)) throw new RangeError(`Not a YYYY-MM-DD date: ${excerpt(date)}`);
  return Temporal.PlainDate.from(date, { overflow: 'reject' });
}

/** An instant in the API's form: `YYYY-MM-DDTHH:MM[:SS[.fff]]Z`, UTC only. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?Z$/;

/** True for a well-formed UTC instant string that is a real moment. */
export function isIsoInstant(value: string): boolean {
  return ISO_INSTANT.test(value) && Number.isFinite(Date.parse(value));
}

// The hot helpers below (weekday, adding days) run for every date on every
// calculation, so they use integer day numbers instead of parsing Temporal
// objects. They assume a valid `YYYY-MM-DD`, as every caller passes.
const DAY_MS = 86_400_000;
const dayNumber = (date: IsoDate): number =>
  Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) /
  DAY_MS;
const fromDayNumber = (n: number): IsoDate => new Date(n * DAY_MS).toISOString().slice(0, 10);

/** True when `date` is a real calendar date in `YYYY-MM-DD` form. */
export function isIsoDate(date: string): boolean {
  // A round trip through the day number rejects 2026-02-30 and years before
  // 1000, which Date.UTC would misread. Cheap: it runs for every input date.
  return ISO_DATE.test(date) && fromDayNumber(dayNumber(date)) === date;
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function dayOfWeek(date: IsoDate): number {
  // Day 0 (1970-01-01) was a Thursday.
  return ((((dayNumber(date) + 3) % 7) + 7) % 7) + 1;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(dayNumber(date) + days);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayNumber(to) - dayNumber(from);
}

/** The Monday of the week containing `date` (weeks run Monday to Sunday). */
export function weekStartOf(date: IsoDate): IsoDate {
  return addDays(date, 1 - dayOfWeek(date));
}

/** The calendar month of `date`, `YYYY-MM`. */
export function monthOf(date: IsoDate): string {
  return date.slice(0, 7);
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

export function firstDayOfMonth(date: IsoDate): IsoDate {
  return `${monthOf(date)}-01`;
}

export function lastDayOfMonth(date: IsoDate): IsoDate {
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0));
  return last.toISOString().slice(0, 10);
}

/** Every date in `[from, to)`. */
export function datesInRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let n = dayNumber(from), end = dayNumber(to); n < end; n++) out.push(fromDayNumber(n));
  return out;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

// Zone conversion is the costliest step in a calculation, and the web
// recalculates the same saved rows on every keystroke, so results are memoised
// (bounded; the key is the instant string).
const MEMO_LIMIT = 10_000;
const zonedMemo = new Map<IsoInstant, { date: IsoDate; minutes: number }>();

function londonParts(instant: IsoInstant): { date: IsoDate; minutes: number } {
  let parts = zonedMemo.get(instant);
  if (!parts) {
    const z = Temporal.Instant.from(instant).toZonedDateTimeISO(ZONE);
    parts = { date: z.toPlainDate().toString(), minutes: z.hour * 60 + z.minute };
    if (zonedMemo.size >= MEMO_LIMIT) zonedMemo.clear();
    zonedMemo.set(instant, parts);
  }
  return parts;
}

/** The London calendar date an instant falls on. */
export function localDateOf(instant: IsoInstant): IsoDate {
  return londonParts(instant).date;
}

/** Minutes after London midnight, on the London date the instant falls on. */
export function localMinutesOf(instant: IsoInstant): number {
  return londonParts(instant).minutes;
}

/** The London date today, for a given instant (callers pass "now"). */
export function londonDateAt(instant: IsoInstant | Date): IsoDate {
  return localDateOf(typeof instant === 'string' ? instant : instant.toISOString());
}

/**
 * The instant of a London wall-clock time on a date. A time skipped by the
 * spring-forward change resolves forward, as Temporal's `compatible`
 * disambiguation does; a repeated autumn time resolves to the earlier one.
 */
export function londonInstant(date: IsoDate, minutesOfDay: number): IsoInstant {
  if (!Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay >= 24 * 60) {
    throw new RangeError(`Minutes of day out of range: ${minutesOfDay}`);
  }
  const z = plainDate(date).toZonedDateTime({
    timeZone: ZONE,
    plainTime: Temporal.PlainTime.from({
      hour: Math.floor(minutesOfDay / 60),
      minute: minutesOfDay % 60,
    }),
  });
  return z.toInstant().toString();
}

/**
 * Start and end instants for a day's times, as the week view enters them: an
 * end at or before the start is past midnight, on the next day.
 */
export function shiftInstants(
  date: IsoDate,
  startMinutes: number,
  endMinutes: number,
): { startsAt: IsoInstant; endsAt: IsoInstant; overnight: boolean } {
  const overnight = endMinutes <= startMinutes;
  return {
    startsAt: londonInstant(date, startMinutes),
    endsAt: londonInstant(overnight ? addDays(date, 1) : date, endMinutes),
    overnight,
  };
}

/** Elapsed whole minutes between two instants (negative if `to` is earlier). */
export function minutesBetween(from: IsoInstant, to: IsoInstant): number {
  return Math.trunc((Date.parse(to) - Date.parse(from)) / 60_000);
}
