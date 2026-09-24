import { addDays, type CsvCell, decimalHours, formatDuration, formatFlexi } from '@repo/domain';

import type { SummaryGroup } from './api/keys';
import type { SummaryGroupBy } from './summary-range';
import { countWarnings } from './warnings';

import { formatDate } from '@/lib/format';

type MinutesField = {
  [Key in keyof SummaryGroup]-?: SummaryGroup[Key] extends number ? Key : never;
}[keyof SummaryGroup];

export interface SummaryColumn {
  field: MinutesField;
  label: string;
  /** Flexi shows its direction in words: `+0:40 over`, `−2:00 under`. */
  flexi?: boolean;
  /** How the totals row adds it up: a sum, or the last group's value (a balance). */
  total: 'sum' | 'last';
  /** The table's group heading over this column (the CSV keeps the full label). */
  group?: 'TOIL' | 'Overtime';
  /** The table's shorter label under its group heading ("Taken" under "TOIL"). */
  short?: string;
}

/**
 * The summary's figures, in the order the feature doc lists them (UI →
 * Summary). The table and the CSV both use this list, so they always agree.
 */
export const SUMMARY_COLUMNS: readonly SummaryColumn[] = [
  { field: 'targetMinutes', label: 'Target', total: 'sum' },
  { field: 'creditedMinutes', label: 'Credited', total: 'sum' },
  { field: 'workedMinutes', label: 'Worked', total: 'sum' },
  { field: 'leaveMinutes', label: 'Leave', total: 'sum' },
  { field: 'bankHolidayMinutes', label: 'Bank holidays', total: 'sum' },
  { field: 'flexiMinutes', label: 'Flexi', flexi: true, total: 'sum' },
  { field: 'convertedMinutes', label: 'Converted', total: 'sum' },
  { field: 'toilMinutes', label: 'TOIL', total: 'sum', group: 'TOIL', short: 'Earned' },
  { field: 'toilTakenMinutes', label: 'TOIL taken', total: 'sum', group: 'TOIL', short: 'Taken' },
  {
    field: 'toilUnusedMinutes',
    label: 'TOIL unused',
    total: 'sum',
    group: 'TOIL',
    short: 'Unused',
  },
  {
    field: 'overtimePaidMinutes',
    label: 'Overtime paid',
    total: 'sum',
    group: 'Overtime',
    short: 'Paid',
  },
  {
    field: 'overtimeUnpaidMinutes',
    label: 'Overtime unpaid',
    total: 'sum',
    group: 'Overtime',
    short: 'Unpaid',
  },
  { field: 'flexiBalanceEndMinutes', label: 'Flexi balance at end', flexi: true, total: 'last' },
];

/** A figure as the table shows it (`h:mm`; flexi signed, with a word). */
export function formatFigure(column: SummaryColumn, minutes: number): string {
  return column.flexi ? formatFlexi(minutes) : formatDuration(minutes);
}

/** The totals row: each column summed, or the last group's balance. */
export function summaryTotals(groups: readonly SummaryGroup[]): Record<MinutesField, number> {
  const totals = {} as Record<MinutesField, number>;
  for (const column of SUMMARY_COLUMNS) {
    totals[column.field] =
      column.total === 'last'
        ? (groups.at(-1)?.[column.field] ?? 0)
        : groups.reduce((sum, group) => sum + group[column.field], 0);
  }
  return totals;
}

/**
 * Where a period stands on `today`: `past` once it has ended, `in-progress`
 * while it holds today, `upcoming` before it starts. A period's target counts
 * all its working days, while flexi counts only the days up to today, so a
 * period that is not past shows more target than it has credited.
 */
export function periodState(
  group: Pick<SummaryGroup, 'start' | 'end'>,
  today: string,
): 'past' | 'in-progress' | 'upcoming' {
  if (today < group.start) return 'upcoming';
  return today < group.end ? 'in-progress' : 'past';
}

/** "Week of 5 Oct 2026" or "October 2026". */
export function periodLabel(group: SummaryGroup, groupBy: SummaryGroupBy): string {
  if (groupBy === 'month') return formatDate(group.start, 'monthYear');
  return `Week of ${formatDate(group.start, 'dayMonth')} ${group.start.slice(0, 4)}`;
}

const CONVERSION_LABELS = { OFF: 'Off', PREVIEW: 'Preview', APPLIED: 'Applied' } as const;

/**
 * The summary as CSV rows (for `toCsv`): one row per group and a totals row.
 * Every figure is in `h:mm` and in decimal hours (feature doc → Export); the
 * dates are inclusive; week rows add the conversion's state.
 */
export function summaryCsvRows(
  groups: readonly SummaryGroup[],
  groupBy: SummaryGroupBy,
): CsvCell[][] {
  const header: CsvCell[] = [
    groupBy === 'week' ? 'Week' : 'Month',
    'From',
    'To',
    ...SUMMARY_COLUMNS.flatMap((column) => [`${column.label} (h:mm)`, `${column.label} (hours)`]),
    ...(groupBy === 'week' ? ['Conversion'] : []),
    'Warnings',
  ];
  const figures = (value: (field: MinutesField) => number): CsvCell[] =>
    SUMMARY_COLUMNS.flatMap((column) => {
      const minutes = value(column.field);
      return [formatDuration(minutes), decimalHours(minutes)];
    });
  const rows = groups.map((group): CsvCell[] => [
    periodLabel(group, groupBy),
    group.start,
    addDays(group.end, -1),
    ...figures((field) => group[field]),
    ...(groupBy === 'week' ? [CONVERSION_LABELS[group.conversion ?? 'OFF']] : []),
    countWarnings(group.warnings)
      .map((warning) => warning.label)
      .join('; '),
  ]);
  const totals = summaryTotals(groups);
  const first = groups.at(0);
  const last = groups.at(-1);
  const totalRow: CsvCell[] = [
    'Total',
    first?.start ?? null,
    last ? addDays(last.end, -1) : null,
    ...figures((field) => totals[field]),
    ...(groupBy === 'week' ? [null] : []),
    null,
  ];
  return [header, ...rows, totalRow];
}
