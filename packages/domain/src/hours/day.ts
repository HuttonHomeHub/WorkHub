import {
  dayOfWeek,
  type IsoDate,
  type IsoInstant,
  isIsoInstant,
  minutesBetween,
} from '../core/time/index.js';

import { WEEKDAY_KEYS, type WeekdayKey, type WorkTerms } from './types.js';

/** The weekday key (`mon` … `sun`) of a date. */
export function weekdayKey(date: IsoDate): WeekdayKey {
  return WEEKDAY_KEYS[dayOfWeek(date) - 1] as WeekdayKey;
}

/** Terms sorted by `effectiveFrom`, earliest first. */
export function sortTerms(terms: readonly WorkTerms[]): WorkTerms[] {
  return [...terms].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

/**
 * Rule 1: the terms in force on a date — the latest `effectiveFrom` on or
 * before it — or `null` before the tracking start.
 */
export function termsFor(sortedTerms: readonly WorkTerms[], date: IsoDate): WorkTerms | null {
  let found: WorkTerms | null = null;
  for (const terms of sortedTerms) {
    if (terms.effectiveFrom <= date) found = terms;
    else break;
  }
  return found;
}

export type SpanError = 'INCOMPLETE' | 'INVALID_INSTANT' | 'NOT_AFTER_START' | 'OVER_24_HOURS';

/** The most a single span may last (the database's `CHECK` agrees). */
export const MAX_SPAN_MINUTES = 24 * 60;

/** Why a start and end cannot be a span, or `null` when they can (or are both empty). */
export function checkSpan(
  startsAt: IsoInstant | null,
  endsAt: IsoInstant | null,
): SpanError | null {
  if (startsAt === null && endsAt === null) return null;
  if (startsAt === null || endsAt === null) return 'INCOMPLETE';
  if (!isIsoInstant(startsAt) || !isIsoInstant(endsAt)) return 'INVALID_INSTANT';
  const span = minutesBetween(startsAt, endsAt);
  if (span <= 0) return 'NOT_AFTER_START';
  if (span > MAX_SPAN_MINUTES) return 'OVER_24_HOURS';
  return null;
}

export interface WorkedTime {
  spanMinutes: number;
  breakDeductedMinutes: number;
  workedMinutes: number;
  /** The break minimum raised the recorded break (a note, rule 13). */
  breakRaised: boolean;
}

/**
 * Rule 3: elapsed minutes on instants (so a night across a clock change is an
 * hour shorter or longer), minus the deducted break. Over the threshold, the
 * deducted break is at least the break minimum.
 */
export function workedTime(
  spanMinutes: number,
  breakRecordedMinutes: number,
  terms: Pick<WorkTerms, 'breakThresholdMinutes' | 'breakMinimumMinutes'>,
): WorkedTime {
  const deducted =
    spanMinutes > terms.breakThresholdMinutes
      ? Math.max(breakRecordedMinutes, terms.breakMinimumMinutes)
      : breakRecordedMinutes;
  return {
    spanMinutes,
    breakDeductedMinutes: deducted,
    workedMinutes: Math.max(0, spanMinutes - deducted),
    breakRaised: deducted > breakRecordedMinutes,
  };
}
