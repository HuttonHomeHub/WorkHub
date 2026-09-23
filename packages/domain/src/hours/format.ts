/**
 * Parsing and display of times and durations (rule 14). Display is `h:mm`;
 * negative values use a true minus sign (U+2212). Decimal hours are for CSV
 * only.
 */
const MINUS = '−';

/**
 * A 24-hour time of day typed as `0830`, `830`, `8:30`, `08.30` or `7`
 * (07:00), in minutes after midnight; `null` when it is not a valid time.
 * `24:00` is not a time of day.
 */
export function parseTimeOfDay(text: string): number | null {
  const value = text.trim();
  let hours: number;
  let minutes: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{1,2})[:.](\d{2})$/.exec(value))) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else if ((match = /^(\d{1,2})(\d{2})$/.exec(value))) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
  } else if ((match = /^(\d{1,2})$/.exec(value))) {
    hours = Number(match[1]);
    minutes = 0;
  } else {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** `HH:MM`, zero-padded, for a time of day. */
export function formatTimeOfDay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * A duration typed as `0:30`, `7:30`, `30m`, `7.5h`, `7h` or a bare number of
 * hours (`7.5`), in whole minutes; `null` when unreadable or negative.
 * Fractions of a minute round to the nearest minute.
 */
export function parseDuration(text: string): number | null {
  const value = text.trim().toLowerCase().replace(/\s+/g, '');
  if (value === '') return null;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{1,4}):(\d{2})$/.exec(value))) {
    const minutes = Number(match[2]);
    return minutes > 59 ? null : Number(match[1]) * 60 + minutes;
  }
  if ((match = /^(\d{1,5})m$/.exec(value))) return Number(match[1]);
  if ((match = /^(\d{1,4}(?:\.\d+)?|\.\d+)h?$/.exec(value))) {
    return Math.round(Number(match[1]) * 60);
  }
  return null;
}

/** `h:mm` with a minus sign when negative: `7:30`, `40:30`, `−2:00`. */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(minutes);
  const text = `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
  return minutes < 0 ? `${MINUS}${text}` : text;
}

/** Signed `h:mm` with a sign always shown: `+0:40`, `−2:00`, `0:00`. */
export function formatSignedDuration(minutes: number): string {
  if (minutes > 0) return `+${formatDuration(minutes)}`;
  return formatDuration(minutes);
}

/**
 * Flexi with its direction in words, never colour alone: `+0:40 over`,
 * `−2:00 under`, `0:00`.
 */
export function formatFlexi(minutes: number): string {
  if (minutes > 0) return `${formatSignedDuration(minutes)} over`;
  if (minutes < 0) return `${formatSignedDuration(minutes)} under`;
  return formatDuration(0);
}

/** Decimal hours to two places, for CSV: 450 → 7.5, −130 → −2.17. */
export function decimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}
