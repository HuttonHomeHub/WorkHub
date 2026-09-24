import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, formatDuration, toCsv } from '@repo/domain';
import { CalendarSearch, Download, Info } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import type { SummaryGroup } from '../api/keys';
import { useTimeBalances } from '../api/time-balances';
import { useTimeSummaries } from '../api/time-summaries';
import { summaryRangeFormSchema, type SummaryRangeFormValues } from '../schemas/summary';
import { periodState, summaryCsvRows } from '../summary-columns';
import {
  apiRange,
  PRESET_LABELS,
  presetOf,
  presetRange,
  rangeProblem,
  resolveRange,
  type SummaryGroupBy,
  type SummaryPreset,
  type SummaryRange,
} from '../summary-range';

import { LoadError, LoadingRows } from './request-states';
import { SummaryTable } from './summary-table';

import { PageHeader } from '@/components/layout/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { ProgressBar } from '@/components/ui/progress';
import { ApiRequestError } from '@/lib/api/client';
import { downloadText } from '@/lib/download';
import { formatDate } from '@/lib/format';

export interface SummarySearch {
  from: string;
  to: string;
  groupBy: SummaryGroupBy;
}

export interface HoursSummaryProps {
  /** The URL's search params, already validated (either date may be missing). */
  search: {
    from?: string | undefined;
    to?: string | undefined;
    groupBy?: SummaryGroupBy | undefined;
  };
  /** Writes a new range or grouping to the URL (a history entry each). */
  onSearchChange: (search: SummarySearch) => void;
  /** Today in Europe/London: the presets' reference and the calculations' `asOf`. */
  today: string;
}

const PRESETS: SummaryPreset[] = ['this-month', 'last-month', 'this-year', 'custom'];
const GROUP_LABELS: Record<SummaryGroupBy, string> = { week: 'Week', month: 'Month' };

/** Two dates, explicit-save: the range is shown when the form is submitted. */
function CustomRangeForm({
  range,
  onSubmit,
}: {
  range: SummaryRange;
  onSubmit: (range: SummaryRange) => void;
}) {
  const form = useForm<SummaryRangeFormValues>({
    resolver: zodResolver(summaryRangeFormSchema),
    defaultValues: range,
  });
  return (
    <Form {...form}>
      <form
        // eslint-disable-next-line @typescript-eslint/no-misused-promises -- RHF handleSubmit returns a promise by design
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        aria-label="Custom dates"
        className="grid gap-3"
      >
        <div className="flex flex-wrap items-start gap-3">
          {(['from', 'to'] as const).map((name) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem className="content-start">
                  <FormLabel>{name === 'from' ? 'From' : 'To'}</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      min="2000-01-01"
                      max="2100-12-31"
                      className="w-(--width-input-date)"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>
        <div>
          <Button type="submit" variant="outline">
            Show these dates
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** The leave year of the range's end: allowance, used and remaining (rule 12), as a card. */
function LeaveYearStrip({ year }: { year: number }) {
  const balances = useTimeBalances(`${String(year)}-12-31`);
  const headingId = React.useId();
  let body: React.ReactNode;
  if (balances.isPending) {
    body = <LoadingRows label={`Loading leave for ${String(year)}`} rows={1} />;
  } else if (balances.isError) {
    body = (
      <LoadError
        message={`We couldn't load your leave for ${String(year)}.`}
        onRetry={() => void balances.refetch()}
      />
    );
  } else if (balances.data.trackingStart === null) {
    body = <p className="text-muted-foreground">No leave is tracked yet.</p>;
  } else {
    const data = balances.data;
    const over = data.leaveRemainingMinutes < 0;
    const items: [string, React.ReactNode][] = [
      ['Allowance', formatDuration(data.leaveAllowanceMinutes)],
      ['Used', formatDuration(data.leaveUsedMinutes)],
      [
        'Remaining',
        <>
          {formatDuration(data.leaveRemainingMinutes)}
          {over ? <span className="text-warning-text text-small"> (over allowance)</span> : null}
        </>,
      ],
    ];
    body = (
      <div className="grid gap-3">
        <dl className="flex flex-wrap gap-3">
          {items.map(([term, value]) => (
            <div
              key={term}
              className="bg-muted/60 grid min-w-40 flex-1 gap-0.5 rounded-lg px-3 py-2.5"
            >
              <dt className="text-muted-foreground text-small">{term}</dt>
              <dd className="text-h2 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <ProgressBar value={data.leaveUsedMinutes} max={data.leaveAllowanceMinutes} />
      </div>
    );
  }
  return (
    <Card role="region" aria-labelledby={headingId} className="grid gap-3 p-4">
      <h2 id={headingId} className="text-h3">
        Leave year {year}
      </h2>
      {body}
    </Card>
  );
}

/** Whether nothing at all was recorded or credited in the groups. */
function nothingRecorded(groups: readonly SummaryGroup[]): boolean {
  return groups.every((group) => group.creditedMinutes === 0 && group.workedMinutes === 0);
}

/** A 422 from the API: its message and details, in place of the table. */
function RangeRefused({ error }: { error: ApiRequestError }) {
  const details = Array.isArray(error.details)
    ? error.details.filter((detail): detail is string => typeof detail === 'string')
    : [];
  return (
    <Alert variant="destructive">
      <AlertTitle>{error.message}</AlertTitle>
      <AlertDescription>
        {details.length > 0 ? `${details.join('. ')}. ` : ''}Choose other dates.
      </AlertDescription>
    </Alert>
  );
}

/**
 * The hours summary (`/hours/summary`; feature doc → UI → Summary): totals by
 * week or month for a range held in the URL, with presets, custom dates, a
 * totals row, warnings, the leave year, and "Download CSV" as the primary
 * action (built in the browser from the rows shown).
 */
export function HoursSummary({ search, onSearchChange, today }: HoursSummaryProps) {
  const range = resolveRange(search, today);
  const groupBy = search.groupBy ?? 'week';
  const problem = rangeProblem(range);
  const preset = presetOf(range, today);
  const rangeKey = `${range.from}/${range.to}`;
  // "Custom" chosen from the list shows the date inputs for the range on screen.
  const [customFor, setCustomFor] = React.useState<string | null>(null);
  const showCustom = preset === 'custom' || customFor === rangeKey;

  const summaries = useTimeSummaries(
    { ...(problem ? { from: range.from, to: range.from } : apiRange(range)), groupBy, asOf: today },
    { enabled: problem === null, keepPrevious: true },
  );
  const groups = summaries.data ?? [];
  const hasRows = summaries.isSuccess && !nothingRecorded(groups);
  const noteId = React.useId();
  const targetNoteId = React.useId();

  const go = (next: Partial<SummarySearch>) => onSearchChange({ ...range, groupBy, ...next });

  const download = () => {
    downloadText(
      `hours-summary-${range.from}-${range.to}.csv`,
      toCsv(summaryCsvRows(groups, groupBy)),
    );
  };

  const rangeText = `${formatDate(range.from)} to ${formatDate(range.to)}`;
  const first = groups.at(0);
  const last = groups.at(-1);
  const widened =
    first && last && (first.start < range.from || addDays(last.end, -1) > range.to)
      ? `${groupBy === 'week' ? 'Weeks' : 'Months'} are shown whole, so the table covers ${formatDate(first.start)} to ${formatDate(addDays(last.end, -1))}.`
      : null;

  let content: React.ReactNode;
  if (problem) {
    content = (
      <Alert variant="destructive">
        <AlertDescription>{problem}</AlertDescription>
      </Alert>
    );
  } else if (summaries.isPending) {
    content = <LoadingRows label="Loading the summary" rows={5} />;
  } else if (summaries.isError) {
    content =
      summaries.error instanceof ApiRequestError && summaries.error.status === 422 ? (
        <RangeRefused error={summaries.error} />
      ) : (
        <LoadError
          message="We couldn't load the summary."
          onRetry={() => void summaries.refetch()}
        />
      );
  } else if (!hasRows) {
    content = (
      <EmptyState
        icon={CalendarSearch}
        title="No time recorded between these dates."
        description="Choose other dates, or record time in the week view."
      />
    );
  } else {
    // A period that has not ended counts its whole target but only the days
    // up to today in its flexi, so the table says so (app-shell-refresh.md).
    const unfinished = groups.some((group) => periodState(group, today) !== 'past');
    const describedBy =
      [widened ? noteId : null, unfinished ? targetNoteId : null].filter(Boolean).join(' ') ||
      undefined;
    content = (
      <div className="grid" aria-busy={summaries.isPlaceholderData}>
        <SummaryTable
          groups={groups}
          groupBy={groupBy}
          today={today}
          caption={`Hours by ${groupBy}, ${rangeText}`}
          describedBy={describedBy}
        />
        {widened || unfinished ? (
          <div className="text-muted-foreground text-small grid gap-1 border-t px-4 py-3">
            {widened ? <p id={noteId}>{widened}</p> : null}
            {unfinished ? (
              <p id={targetNoteId} className="flex gap-1.5">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Target counts every working day of a period, including days still to come; flexi
                  counts the days up to today, {formatDate(today, 'weekdayDayMonth')}. So a period
                  in progress shows more target than credited time.
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Hours summary"
        description={`${rangeText}, by ${groupBy}`}
        actions={
          <Button onClick={download} disabled={!hasRows || problem !== null}>
            <Download aria-hidden />
            Download CSV
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid gap-4 border-b p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="summary-dates">Dates</Label>
              <NativeSelect
                id="summary-dates"
                className="w-(--width-input-date)"
                value={showCustom ? 'custom' : preset}
                onChange={(event) => {
                  const chosen = event.target.value as SummaryPreset;
                  const next = presetRange(chosen, today);
                  if (next) {
                    setCustomFor(null);
                    go(next);
                  } else {
                    setCustomFor(rangeKey);
                  }
                }}
              >
                {PRESETS.map((value) => (
                  <option key={value} value={value}>
                    {PRESET_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="summary-group-by">Group by</Label>
              <NativeSelect
                id="summary-group-by"
                className="w-(--width-input-short)"
                value={groupBy}
                onChange={(event) => go({ groupBy: event.target.value as SummaryGroupBy })}
              >
                {(['week', 'month'] as const).map((value) => (
                  <option key={value} value={value}>
                    {GROUP_LABELS[value]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {showCustom ? (
            <CustomRangeForm
              key={rangeKey}
              range={range}
              onSubmit={(next) => {
                setCustomFor(`${next.from}/${next.to}`);
                go(next);
              }}
            />
          ) : null}
        </div>
        {problem || summaries.isError ? <div className="p-4">{content}</div> : content}
      </Card>

      <LeaveYearStrip year={Number(range.to.slice(0, 4))} />
    </div>
  );
}
