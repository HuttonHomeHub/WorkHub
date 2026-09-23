import { TriangleAlert } from 'lucide-react';
import * as React from 'react';

import type { SummaryGroup } from '../api/keys';
import { formatFigure, periodLabel, SUMMARY_COLUMNS, summaryTotals } from '../summary-columns';
import type { SummaryGroupBy } from '../summary-range';
import { countWarnings } from '../warnings';

import { Badge } from '@/components/ui/badge';

interface SummaryTableProps {
  groups: readonly SummaryGroup[];
  groupBy: SummaryGroupBy;
  /** The table's accessible name ("Hours by week, 1 Oct to 31 Oct 2026"). */
  caption: string;
  /** The id of a note that describes the table (whole weeks or months). */
  describedBy?: string | undefined;
}

/**
 * A period's warnings, as badges with text in a row of their own under its
 * figures: a column of badges would widen every row of a table that already
 * has fourteen columns.
 */
function WarningsRow({ group, label }: { group: SummaryGroup; label: string }) {
  const warnings = countWarnings(group.warnings);
  if (warnings.length === 0) return null;
  return (
    <tr className="border-b">
      <td colSpan={SUMMARY_COLUMNS.length + 1} className="pb-2">
        <span className="sr-only">Warnings for {label}: </span>
        <ul className="flex flex-wrap gap-1">
          {warnings.map((warning) => (
            <li key={warning.code}>
              <Badge variant={warning.note ? 'outline' : 'warning'}>
                {warning.note ? null : <TriangleAlert aria-hidden />}
                {warning.label}
              </Badge>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

/**
 * The summary's table (feature doc → UI → Summary): a row per week or month
 * with every figure in `h:mm` (right-aligned, tabular numerals), the period's
 * warnings as badges with text under it, and a totals row. It scrolls
 * sideways inside its own container, never the page.
 */
export function SummaryTable({ groups, groupBy, caption, describedBy }: SummaryTableProps) {
  const totals = summaryTotals(groups);
  return (
    // A wide table scrolls inside its own region, which takes focus so the
    // keyboard can scroll it too (the rows hold nothing focusable; axe's
    // scrollable-region-focusable, WCAG 2.1.1).
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a focusable scroll region is the WAI pattern for a wide table
    <div className="relative overflow-x-auto" role="region" aria-label={caption} tabIndex={0}>
      <table className="w-full text-sm" aria-describedby={describedBy}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b align-bottom">
            <th scope="col" className="py-2 pr-3 text-left font-medium whitespace-nowrap">
              {groupBy === 'week' ? 'Week' : 'Month'}
            </th>
            {SUMMARY_COLUMNS.map((column) => (
              <th
                key={column.field}
                scope="col"
                className="px-1.5 py-2 text-right font-medium whitespace-nowrap"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const label = periodLabel(group, groupBy);
            const warned = group.warnings.length > 0;
            return (
              <React.Fragment key={group.key}>
                <tr className={warned ? undefined : 'border-b'}>
                  <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">
                    {label}
                  </th>
                  {SUMMARY_COLUMNS.map((column) => (
                    <td
                      key={column.field}
                      className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums"
                    >
                      {formatFigure(column, group[column.field])}
                    </td>
                  ))}
                </tr>
                <WarningsRow group={group} label={label} />
              </React.Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <th scope="row" className="py-2 pr-3 text-left font-semibold">
              Total
            </th>
            {SUMMARY_COLUMNS.map((column) => (
              <td
                key={column.field}
                className="px-1.5 py-2 text-right whitespace-nowrap tabular-nums"
              >
                {formatFigure(column, totals[column.field])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
