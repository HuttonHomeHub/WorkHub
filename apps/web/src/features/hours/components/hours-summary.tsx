import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, formatDuration, toCsv } from '@repo/domain';
import { Download } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import type { SummaryGroup } from '../api/keys';
import { useTimeBalances } from '../api/time-balances';
import { useTimeSummaries } from '../api/time-summaries';
import { summaryRangeFormSchema, type SummaryRangeFormValues } from '../schemas/summary';
import { summaryCsvRows } from '../summary-columns';
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

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
        className="grid gap-4"
      >
        <div className="flex flex-wrap items-start gap-4">
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
                      className="w-40"
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

/** The leave year of the range's end: allowance, used and remaining (rule 12). */
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
    const items: [string, string][] = [
      ['Allowance', formatDuration(data.leaveAllowanceMinutes)],
      ['Used', formatDuration(data.leaveUsedMinutes)],
      [
        'Remaining',
        `${formatDuration(data.leaveRemainingMinutes)}${data.leaveRemainingMinutes < 0 ? ' (over allowance)' : ''}`,
      ],
    ];
    body = (
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        {items.map(([term, value]) => (
          <div key={term} className="flex gap-2">
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <section aria-labelledby={headingId} className="grid gap-2 border-y py-3 text-sm">
      <h2 id={headingId} className="font-semibold">
        Leave year {year}
      </h2>
      {body}
    </section>
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
    content = <p className="text-sm">No time recorded between these dates.</p>;
  } else {
    content = (
      <div className="grid gap-2" aria-busy={summaries.isPlaceholderData}>
        <SummaryTable
          groups={groups}
          groupBy={groupBy}
          caption={`Hours by ${groupBy}, ${rangeText}`}
          describedBy={widened ? noteId : undefined}
        />
        {widened ? (
          <p id={noteId} className="text-muted-foreground text-sm">
            {widened}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Hours summary</h1>
          <p className="text-muted-foreground text-sm">
            {rangeText}, by {groupBy}
          </p>
        </div>
        <Button onClick={download} disabled={!hasRows || problem !== null}>
          <Download aria-hidden />
          Download CSV
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="grid gap-2">
          <Label htmlFor="summary-dates">Dates</Label>
          <NativeSelect
            id="summary-dates"
            className="w-40"
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
        <div className="grid gap-2">
          <Label htmlFor="summary-group-by">Group by</Label>
          <NativeSelect
            id="summary-group-by"
            className="w-32"
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

      {content}

      <LeaveYearStrip year={Number(range.to.slice(0, 4))} />
    </div>
  );
}
