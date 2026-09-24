import {
  addDays,
  daysCsvRows,
  firstDayOfMonth,
  lastDayOfMonth,
  toCsv,
  weekStartOf,
  yearOf,
  type IsoDate,
} from '@repo/domain';
import { Link } from '@tanstack/react-router';
import {
  CalendarClock,
  CalendarCog,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
} from 'lucide-react';
import * as React from 'react';

import { useWeekConversion, useWeekWorkDays } from '../api/work-days';
import { useWorkTerms } from '../api/work-terms';
import { useWeekRecalculation } from '../hooks/use-week-recalculation';
import { calculateWeek, toEngineTerms, type WeekCalculation } from '../week/week-calculation';
import { canMoveWeek, weekDates } from '../week/week-dates';

import { fieldId } from './day-row';
import { LoadError } from './request-states';
import { columnCount, toEngineDay, WeekTable, WeekTableHead } from './week-table';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableContainer, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { usePublicHolidays } from '@/features/core/public-holidays';
import { useDelayedFlag } from '@/hooks/use-delayed-flag';
import { downloadText } from '@/lib/download';
import { formatDate } from '@/lib/format';

/** What the week view hands its aside (slice 10's "This week" and "Balances" panels). */
export interface WeekAsideContext {
  weekStart: IsoDate;
  /** Today in Europe/London. */
  asOf: IsoDate;
  /**
   * The live figures for the shown week, unsaved rows included; `null` while
   * loading, before the tracking start or without terms. Only its week-local
   * figures are valid (`week/week-calculation.ts`).
   */
  calculation: WeekCalculation | null;
  /** Rule 11's latest message for the week, for a polite live region. */
  recalculationNotice: string;
}

export interface WeekViewProps {
  /** The week shown: a Monday, from the URL (`?week=`). */
  weekStart: IsoDate;
  /** Today in Europe/London. */
  today: IsoDate;
  onWeekChange: (weekStart: IsoDate) => void;
  /**
   * The aside's content, beside the table on a wide window and below it when
   * both do not fit (down to the reflow floor): `WeekAside`.
   */
  aside?: (context: WeekAsideContext) => React.ReactNode;
  /** The headline figures above the table and aside, for a tracked week: `WeekOverview`. */
  overview?: (context: WeekAsideContext) => React.ReactNode;
}

const HEADING_ID = 'hours-week-heading';

/** The week's rows while loading: skeletons at the final row height, after 300ms. */
function LoadingTable() {
  const show = useDelayedFlag(true);
  return (
    <TableContainer aria-busy="true">
      <Table aria-labelledby={HEADING_ID} className="text-small">
        <WeekTableHead />
        <TableBody>
          {Array.from({ length: 7 }, (_, index) => (
            <TableRow key={index} hover={false} tone={index % 2 === 1 ? 'stripe' : 'default'}>
              <TableCell colSpan={columnCount(false)} className="h-(--row-height-comfortable)">
                {index === 0 ? <span className="sr-only">Loading the week</span> : null}
                {show ? <Skeleton className="h-(--control-sm)" /> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** A failed load: the table's head stays, with the error and Retry in its body. */
function ErrorTable({ onRetry }: { onRetry: () => void }) {
  return (
    <TableContainer>
      <Table aria-labelledby={HEADING_ID} className="text-small">
        <WeekTableHead />
        <TableBody>
          <TableRow hover={false}>
            <TableCell colSpan={columnCount(false)} className="py-3">
              <LoadError message="We couldn't load this week." onRetry={onRetry} />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * The hours week view (`/hours?week=`, docs/features/hours-tracker.md → UI →
 * Week view): a page header with the week navigator, links to the summary
 * (the week's month) and settings, "Download CSV" and "Go to today" (the
 * primary action, which focuses today's Start field), then the day table and
 * the aside (`aside`, filled by the route with `WeekAside`).
 *
 * Data: the owner's terms, the week's days, the week's conversion switch and
 * the bank holidays of the week's years. Every figure in the table is
 * week-local, so nothing earlier than the week is loaded
 * (`week/week-calculation.ts`).
 */
export function WeekView({ weekStart, today, onWeekChange, aside, overview }: WeekViewProps) {
  const terms = useWorkTerms();
  const days = useWeekWorkDays(weekStart);
  const conversion = useWeekConversion(weekStart);
  const firstYear = yearOf(weekStart);
  const lastYear = yearOf(addDays(weekStart, 6));
  const holidaysFirst = usePublicHolidays(firstYear);
  const holidaysLast = usePublicHolidays(lastYear);
  const [focusDate, setFocusDate] = React.useState<IsoDate | null>(null);
  const [calculation, setCalculation] = React.useState<WeekCalculation | null>(null);
  const clearFocus = React.useCallback(() => setFocusDate(null), []);
  const recalculation = useWeekRecalculation(weekStart, today);

  const queries = [terms, days, conversion, holidaysFirst, holidaysLast];
  const pending = queries.some((query) => query.isPending);
  const failed = queries.some((query) => query.isError);

  const engineTerms = React.useMemo(() => (terms.data ?? []).map(toEngineTerms), [terms.data]);
  const trackingStart = terms.data?.reduce<IsoDate | null>(
    (earliest, row) =>
      earliest === null || row.effectiveFrom < earliest ? row.effectiveFrom : earliest,
    null,
  );
  const publicHolidays = React.useMemo(
    () => [...(holidaysFirst.data ?? []), ...(holidaysLast.data ?? [])].map((row) => row.date),
    [holidaysFirst.data, holidaysLast.data],
  );
  const tracked =
    !pending && !failed && trackingStart !== null && trackingStart !== undefined
      ? weekStart >= trackingStart
      : false;

  const todayWeek = weekDates(weekStart).includes(today);
  // "Summary" opens the shown week's month, by week.
  const summaryRange = { from: firstDayOfMonth(weekStart), to: lastDayOfMonth(weekStart) };

  const goToToday = () => {
    if (todayWeek) {
      document.getElementById(fieldId('start', today))?.focus();
      return;
    }
    setFocusDate(today);
    onWeekChange(weekStartOf(today));
  };

  const downloadCsv = () => {
    if (!days.data) return;
    const saved = calculateWeek({
      weekStart,
      terms: engineTerms,
      days: days.data.map(toEngineDay),
      converting: conversion.data !== null && conversion.data !== undefined,
      publicHolidays,
      asOf: today,
    });
    if (!saved) return;
    const rows = daysCsvRows(
      saved.result,
      days.data.map(toEngineDay),
      weekStart,
      addDays(weekStart, 7),
    );
    downloadText(`hours-${weekStart}.csv`, toCsv(rows));
    toast({ title: `Week of ${formatDate(weekStart, 'medium')} downloaded` });
  };

  const retry = () => {
    for (const query of queries) if (query.isError) void query.refetch();
  };

  let body: React.ReactNode;
  if (pending) {
    body = <LoadingTable />;
  } else if (failed) {
    body = <ErrorTable onRetry={retry} />;
  } else if (!trackingStart) {
    body = (
      <EmptyState
        icon={CalendarCog}
        title="Set your working terms to start tracking hours."
        description="Your terms set the flexi target for each weekday, the break rule and the working band."
        action={
          <Button asChild>
            <Link to="/hours/settings" search={{ tab: 'terms' }}>
              Set working terms
            </Link>
          </Button>
        }
      />
    );
  } else if (!tracked) {
    body = (
      <EmptyState
        icon={CalendarClock}
        title={`Tracking starts on ${formatDate(trackingStart)}.`}
        description="Weeks before your first terms have nothing to track."
        action={
          <Button variant="outline" onClick={() => onWeekChange(trackingStart)}>
            Go to the first week
          </Button>
        }
      />
    );
  } else {
    body = (
      <WeekTable
        key={weekStart}
        weekStart={weekStart}
        today={today}
        terms={engineTerms}
        savedDays={days.data ?? []}
        converting={conversion.data !== null && conversion.data !== undefined}
        publicHolidays={publicHolidays}
        labelledBy={HEADING_ID}
        focusDate={focusDate}
        onFocusDone={clearFocus}
        onReload={() => void days.refetch()}
        onCalculated={setCalculation}
        onEditStart={recalculation.begin}
      />
    );
  }

  const empty = tracked && days.data?.length === 0;
  const context: WeekAsideContext = {
    weekStart,
    asOf: today,
    calculation: tracked && calculation?.week.weekStart === weekStart ? calculation : null,
    recalculationNotice: recalculation.notice,
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Hours"
        description={`Today is ${formatDate(today, 'long')}`}
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link to="/hours/summary" search={{ ...summaryRange, groupBy: 'week' }}>
                <ChartColumn aria-hidden />
                Summary
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/hours/settings">
                <Settings aria-hidden />
                Settings
              </Link>
            </Button>
            <Button variant="outline" onClick={downloadCsv} disabled={!tracked}>
              <Download aria-hidden />
              Download CSV
            </Button>
            <Button onClick={goToToday}>Go to today</Button>
          </>
        }
      />
      {overview && tracked ? overview(context) : null}
      {/* Layout: the table takes the room and the aside sits beside it once the
          content is 56rem wide (a 1280px window); below that, down to the reflow
          floor, the aside stacks under the table. */}
      <div className="@container">
        <div className="@4xl:grid-cols-main-aside @7xl:grid-cols-main-aside-wide grid grid-cols-1 items-start gap-4">
          <section aria-labelledby={HEADING_ID} className="@container min-w-0">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-3 py-2">
                <div className="flex min-w-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Previous week"
                    disabled={!canMoveWeek(weekStart, -1)}
                    onClick={() => onWeekChange(addDays(weekStart, -7))}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <h2 id={HEADING_ID} aria-live="polite" className="text-h3 min-w-0 px-1">
                    Week of {formatDate(weekStart, 'medium')}
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Next week"
                    disabled={!canMoveWeek(weekStart, 1)}
                    onClick={() => onWeekChange(addDays(weekStart, 7))}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
                {empty ? (
                  <p className="text-muted-foreground text-small">No time recorded this week.</p>
                ) : null}
              </div>
              {body}
              {tracked ? (
                <p className="text-muted-foreground text-meta border-t px-3 py-2.5">
                  Type times as 0830 or 8:30 and durations as 0:30, 30m or 7.5h. Enter saves a day;
                  Esc undoes its changes.
                </p>
              ) : null}
            </Card>
          </section>
          {aside ? (
            <div data-slot="week-aside" className="min-w-0">
              {aside(context)}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
