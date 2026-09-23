import { formatDuration, formatTimeOfDay, parseDuration, parseTimeOfDay } from '@repo/domain';
import { isHoursDate, isMonday } from '@repo/types';
import { z } from 'zod';

/**
 * Zod fields for the hours forms. The owner types durations as `h:mm` (and
 * `30m`, `7.5h`) and times as `08:30`; the form keeps that text and each field
 * turns it into the API's integer minutes. Every bound comes from
 * `@repo/types` (ADR-0017), passed in by the schema that uses the field.
 */

const MINUS_SIGNS = /^[-−]/;

/**
 * A signed duration: `−2:00`, `-30m`, `+1:15` or `1:15`, in minutes; `null`
 * when it cannot be read.
 */
export function parseSignedDuration(text: string): number | null {
  const value = text.trim();
  const sign = MINUS_SIGNS.test(value) ? -1 : 1;
  const minutes = parseDuration(value.replace(/^[-−+]\s*/, ''));
  return minutes === null ? null : sign * minutes;
}

/** The text a duration field shows for a number of minutes. */
export function durationText(minutes: number | null | undefined): string {
  return minutes === null || minutes === undefined ? '' : formatDuration(minutes);
}

interface DurationBounds {
  /** The least number of minutes allowed (default 0). */
  min?: number;
  max: number;
}

function checkBounds(minutes: number, { min = 0, max }: DurationBounds, ctx: z.RefinementCtx) {
  if (minutes < min) {
    ctx.addIssue({
      code: 'custom',
      message: min === 1 ? 'Enter more than 0:00.' : `Enter at least ${formatDuration(min)}.`,
    });
  } else if (minutes > max) {
    ctx.addIssue({ code: 'custom', message: `Enter at most ${formatDuration(max)}.` });
  }
}

const UNREADABLE_DURATION = 'Enter hours and minutes, such as 7:30.';

/** A duration the owner must fill in, in minutes. */
export function requiredDuration(bounds: DurationBounds) {
  return z.string().transform((text, ctx) => {
    if (text.trim() === '') {
      ctx.addIssue({ code: 'custom', message: 'Enter a duration, such as 7:30.' });
      return z.NEVER;
    }
    const minutes = parseDuration(text);
    if (minutes === null) {
      ctx.addIssue({ code: 'custom', message: UNREADABLE_DURATION });
      return z.NEVER;
    }
    checkBounds(minutes, bounds, ctx);
    return minutes;
  });
}

/** A duration that may be left empty (`null`, "not set"), in minutes. */
export function optionalDuration(bounds: DurationBounds) {
  return z.string().transform((text, ctx): number | null => {
    if (text.trim() === '') return null;
    const minutes = parseDuration(text);
    if (minutes === null) {
      ctx.addIssue({ code: 'custom', message: UNREADABLE_DURATION });
      return z.NEVER;
    }
    checkBounds(minutes, bounds, ctx);
    return minutes;
  });
}

/** A signed duration that is never zero, within ±`max` minutes. */
export function signedDuration(max: number) {
  return z.string().transform((text, ctx) => {
    const minutes = parseSignedDuration(text);
    if (text.trim() === '' || minutes === null) {
      ctx.addIssue({ code: 'custom', message: 'Enter hours and minutes, such as 7:30 or −2:00.' });
      return z.NEVER;
    }
    if (minutes === 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount other than 0:00.' });
    } else if (Math.abs(minutes) > max) {
      ctx.addIssue({ code: 'custom', message: `Enter at most ${formatDuration(max)} either way.` });
    }
    return minutes;
  });
}

/** A 24-hour time of day, as the API's `HH:MM`. */
export const timeOfDay = z.string().transform((text, ctx) => {
  const minutes = parseTimeOfDay(text);
  if (minutes === null) {
    ctx.addIssue({ code: 'custom', message: 'Enter a 24-hour time, such as 08:30.' });
    return z.NEVER;
  }
  return formatTimeOfDay(minutes);
});

/** A calendar date within the hours years, `YYYY-MM-DD` (a native date input's value). */
export const hoursDate = z.string().refine(isHoursDate, 'Enter a date between 2000 and 2100.');

/** A Monday, for terms (they apply from the start of a week). */
export const mondayDate = hoursDate.refine(isMonday, 'Choose a Monday: terms start with a week.');
