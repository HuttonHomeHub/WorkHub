import { addDays, daysBetween, firstDayOfMonth, isIsoDate, lastDayOfMonth } from '@repo/domain';

/**
 * The summary's range and grouping (`/hours/summary?from&to&groupBy`). `from`
 * and `to` are both **inclusive** calendar dates, as the owner reads them
 * ("1 to 31 October"); the API's `to` is exclusive, so `apiRange` adds a day.
 */
export type SummaryGroupBy = 'week' | 'month';

export interface SummaryRange {
  from: string;
  /** The last day shown (inclusive). */
  to: string;
}

export type SummaryPreset = 'this-month' | 'last-month' | 'this-year' | 'custom';

/** The longest range the API sums (`time-summaries` returns 422 beyond it). */
export const SUMMARY_MAX_DAYS = 366;

export const PRESET_LABELS: Record<SummaryPreset, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-year': 'This year',
  custom: 'Custom',
};

/** The range a preset stands for, as of `today`; `custom` has none. */
export function presetRange(preset: SummaryPreset, today: string): SummaryRange | null {
  switch (preset) {
    case 'this-month':
      return { from: firstDayOfMonth(today), to: lastDayOfMonth(today) };
    case 'last-month': {
      const lastDay = addDays(firstDayOfMonth(today), -1);
      return { from: firstDayOfMonth(lastDay), to: lastDay };
    }
    case 'this-year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'custom':
      return null;
  }
}

/** The preset a range matches, or `custom`. */
export function presetOf(range: SummaryRange, today: string): SummaryPreset {
  const presets: SummaryPreset[] = ['this-month', 'last-month', 'this-year'];
  return (
    presets.find((preset) => {
      const candidate = presetRange(preset, today);
      return candidate?.from === range.from && candidate.to === range.to;
    }) ?? 'custom'
  );
}

/**
 * The range from the URL: both dates when both are there, otherwise the
 * default, this month (so a bare `/hours/summary` bookmark always opens on the
 * current month).
 */
export function resolveRange(
  search: { from?: string | undefined; to?: string | undefined },
  today: string,
): SummaryRange {
  if (search.from && search.to) return { from: search.from, to: search.to };
  return presetRange('this-month', today) as SummaryRange;
}

/** Why a range cannot be shown, in en-GB copy; `null` when it can. */
export function rangeProblem(range: SummaryRange): string | null {
  if (!isIsoDate(range.from) || !isIsoDate(range.to)) return 'Enter both dates.';
  const days = daysBetween(range.from, range.to) + 1;
  if (days < 1) return 'Choose an end date on or after the start date.';
  if (days > SUMMARY_MAX_DAYS) {
    return `Choose a range of ${String(SUMMARY_MAX_DAYS)} days or fewer.`;
  }
  return null;
}

/** The API's `[from, to)` for an inclusive range. */
export function apiRange(range: SummaryRange): { from: string; to: string } {
  return { from: range.from, to: addDays(range.to, 1) };
}
