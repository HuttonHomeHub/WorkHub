import { Info, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import type { SummaryGroup } from '../api/keys';
import {
  formatFigure,
  periodLabel,
  periodState,
  SUMMARY_COLUMNS,
  summaryTotals,
  type SummaryColumn,
} from '../summary-columns';
import type { SummaryGroupBy } from '../summary-range';
import { countWarnings } from '../warnings';

import { FlexiValue } from './flexi-value';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface SummaryTableProps {
  groups: readonly SummaryGroup[];
  groupBy: SummaryGroupBy;
  /** Today in Europe/London: periods after it are upcoming, the one holding it in progress. */
  today: string;
  /** The table's accessible name ("Hours by week, 1 Oct to 31 Oct 2026"). */
  caption: string;
  /** The ids of the notes that describe the table (whole periods, target to date). */
  describedBy?: string | undefined;
}

/**
 * A period's warnings and notes, as chips with text in a row of their own
 * under its figures: a column of them would widen every row of a table that
 * already has fourteen columns. A note (a break raised to the minimum) is
 * information, drawn as `info`; a warning is drawn as `warning` with a ⚠.
 */
function WarningsRow({
  group,
  label,
  striped,
}: {
  group: SummaryGroup;
  label: string;
  striped: boolean;
}) {
  const warnings = countWarnings(group.warnings);
  if (warnings.length === 0) return null;
  const onlyNotes = warnings.every((warning) => warning.note);
  return (
    <TableRow tone={striped ? 'stripe' : 'default'} hover={false}>
      <TableCell colSpan={SUMMARY_COLUMNS.length + 1} className="h-auto pt-0 pb-2">
        <span className="sr-only">
          {onlyNotes ? 'Notes' : 'Warnings'} for {label}:{' '}
        </span>
        <ul className="flex flex-wrap gap-1.5">
          {warnings.map((warning) => (
            <li key={warning.code}>
              {warning.note ? (
                <Badge variant="info">
                  <Info aria-hidden />
                  <span className="sr-only">Note: </span>
                  {warning.label}
                </Badge>
              ) : (
                <Badge variant="warning">
                  <TriangleAlert aria-hidden />
                  <span className="sr-only">Warning: </span>
                  {warning.label}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </TableCell>
    </TableRow>
  );
}

/** A figure cell: flexi with its status colour and word, the rest as `h:mm`. */
function Amount({ column, minutes }: { column: SummaryColumn; minutes: number }) {
  return column.flexi ? <FlexiValue minutes={minutes} /> : formatFigure(column, minutes);
}

/** The column headers: TOIL and overtime under a group heading each, the rest spanning both rows. */
function HeaderRows({ groupBy }: { groupBy: SummaryGroupBy }) {
  const grouped = SUMMARY_COLUMNS.filter((column) => column.group);
  const firstRow: React.ReactNode[] = [];
  let index = 0;
  while (index < SUMMARY_COLUMNS.length) {
    const column = SUMMARY_COLUMNS[index]!;
    if (column.group) {
      const span = SUMMARY_COLUMNS.filter((other) => other.group === column.group).length;
      firstRow.push(
        <TableHead
          key={column.group}
          scope="colgroup"
          colSpan={span}
          className="border-l px-1.5 pb-0 text-center"
        >
          {column.group}
        </TableHead>,
      );
      index += span;
    } else {
      firstRow.push(
        <TableHead
          key={column.field}
          rowSpan={2}
          numeric
          className="max-w-24 px-1.5 whitespace-normal"
        >
          {column.label}
        </TableHead>,
      );
      index += 1;
    }
  }
  return (
    <TableHeader>
      <TableRow hover={false} className="border-b-0">
        <TableHead rowSpan={2}>{groupBy === 'week' ? 'Week' : 'Month'}</TableHead>
        {firstRow}
      </TableRow>
      <TableRow hover={false}>
        {grouped.map((column, position) => (
          <TableHead
            key={column.field}
            numeric
            className={cn('px-1.5', grouped[position - 1]?.group !== column.group && 'border-l')}
          >
            {column.short ?? column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

const STATE_LABELS = { 'in-progress': 'In progress', upcoming: 'Upcoming' } as const;

/**
 * The summary's table (feature doc → UI → Summary): a row per week or month
 * with every figure in `h:mm` (right-aligned, tabular numerals), flexi in its
 * status colour with its word, the period's warnings and notes as chips under
 * it, and a totals row. A period still under way is marked "In progress" and
 * one that has not started "Upcoming" (its figures muted): their targets count
 * days still to come (docs/features/app-shell-refresh.md → Summary). It
 * scrolls sideways inside its own region, never the page.
 */
export function SummaryTable({ groups, groupBy, today, caption, describedBy }: SummaryTableProps) {
  const totals = summaryTotals(groups);
  return (
    // A wide table scrolls inside its own region, which takes focus so the
    // keyboard can scroll it too (the rows hold nothing focusable; axe's
    // scrollable-region-focusable, WCAG 2.1.1).
    <TableContainer scrollable aria-label={caption}>
      <Table className="text-small" aria-describedby={describedBy}>
        <caption className="sr-only">{caption}</caption>
        <HeaderRows groupBy={groupBy} />
        <TableBody>
          {groups.map((group, index) => {
            const label = periodLabel(group, groupBy);
            const warned = group.warnings.length > 0;
            const state = periodState(group, today);
            const striped = index % 2 === 1;
            return (
              <React.Fragment key={group.key}>
                <TableRow
                  tone={striped ? 'stripe' : 'default'}
                  className={cn(warned && 'border-b-0')}
                >
                  <TableRowHeader className="font-medium whitespace-nowrap">
                    <span className="flex flex-col items-start gap-0.5">
                      {label}{' '}
                      {state === 'past' ? null : (
                        <Badge variant={state === 'in-progress' ? 'info' : 'default'}>
                          {STATE_LABELS[state]}
                        </Badge>
                      )}
                    </span>
                  </TableRowHeader>
                  {SUMMARY_COLUMNS.map((column) => (
                    <TableCell
                      key={column.field}
                      numeric
                      className={cn('px-1.5', state === 'upcoming' && 'text-muted-foreground')}
                    >
                      <Amount column={column} minutes={group[column.field]} />
                    </TableCell>
                  ))}
                </TableRow>
                <WarningsRow group={group} label={label} striped={striped} />
              </React.Fragment>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow hover={false}>
            <TableRowHeader>Total</TableRowHeader>
            {SUMMARY_COLUMNS.map((column) => (
              <TableCell key={column.field} numeric className="px-1.5">
                <Amount column={column} minutes={totals[column.field]} />
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
    </TableContainer>
  );
}
