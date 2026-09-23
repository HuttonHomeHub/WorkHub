/**
 * The shared display formatters (docs/UX_STANDARDS.md → Copy): en-GB, and
 * calendar dates exactly as stored. A `YYYY-MM-DD` date is a calendar day, not
 * an instant, so it is formatted in UTC and never shifts with the zone.
 */

const DATE_FORMATS = {
  /** Mon 5 Oct 2026 */
  short: new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }),
  /** Monday 5 October 2026 */
  long: new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }),
} as const;

/** A `YYYY-MM-DD` calendar date for display: `Mon 5 Oct 2026` (or `long`). */
export function formatDate(isoDate: string, style: keyof typeof DATE_FORMATS = 'short'): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  // en-GB puts a comma after the weekday ("Mon, 5 Oct 2026"); the app's style has none.
  return DATE_FORMATS[style].format(date).replace(',', '');
}
