import { addDays, formatDuration, formatFlexi } from '@repo/domain';
import * as React from 'react';

import {
  type ConversionSwitch,
  useExcessConversions,
  useSwitchConversion,
} from '../api/excess-conversions';
import type { ExcessConversion } from '../api/keys';
import { useTimeSummaries } from '../api/time-summaries';
import { figuresFromGroup, type ThisWeekFigures } from '../this-week-figures';

import { LoadError, LoadingRows, toastSaveError } from './request-states';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatDate } from '@/lib/format';

export interface ThisWeekPanelProps {
  /** The week's Monday (`YYYY-MM-DD`). */
  weekStart: string;
  /** Today in Europe/London (`londonDateAt(new Date())`): what counts and what has settled. */
  asOf: string;
  /**
   * The week's figures from the week view's own engine run over saved and
   * unsaved rows (`thisWeekFigures(result, weekStart)`), so the panel follows
   * typing before a save. Without it (or with `null`), the panel shows the
   * saved figures from `time-summaries`.
   */
  live?: ThisWeekFigures | null;
  /**
   * The latest rule 11 message for this week (`useRecalculationNotice`),
   * shown under the figures and announced by a polite live region.
   */
  recalculationNotice?: string;
}

/** "1:00 paid, 2:00 unpaid", "2:00 unpaid", or "2:00 paid". */
function overtimeText(paid: number, unpaid: number): string {
  if (paid > 0 && unpaid > 0)
    return `${formatDuration(paid)} paid, ${formatDuration(unpaid)} unpaid`;
  if (paid > 0) return `${formatDuration(paid)} paid`;
  return `${formatDuration(unpaid)} unpaid`;
}

function Figure({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * The week's conversion switch. It saves as soon as it is switched (a single
 * reversible toggle, docs/UX_STANDARDS.md → Forms), with a quiet "Saved";
 * Space or Enter toggles it and focus stays on it.
 * switching it back is the undo, so there is no toast. A failed save raises a
 * persistent error toast and the switch shows the saved state again.
 */
function ConversionSwitchField({
  weekStart,
  row,
  onReload,
}: {
  weekStart: string;
  row: ExcessConversion | undefined;
  onReload: () => void;
}) {
  const change = useSwitchConversion();
  const [status, setStatus] = React.useState('');
  const id = React.useId();
  const checked = change.isPending ? change.variables.on : row !== undefined;
  return (
    <div className="flex items-start gap-2">
      <Switch
        id={id}
        className="mt-0.5"
        checked={checked}
        // Not disabled while saving, so focus stays on it; a second switch
        // waits for the first to finish.
        aria-busy={change.isPending}
        onCheckedChange={(on) => {
          if (change.isPending) return;
          setStatus('');
          const next: ConversionSwitch | null = on
            ? { on: true, weekStart }
            : row
              ? { on: false, weekStart, row }
              : null;
          if (!next) return;
          change.mutate(next, {
            onSuccess: () => setStatus('Saved'),
            onError: (error) =>
              toastSaveError(
                on
                  ? "We couldn't switch conversion on for this week"
                  : "We couldn't switch conversion off for this week",
                error,
                onReload,
              ),
          });
        }}
      />
      <Label htmlFor={id} className="leading-5 font-normal">
        Convert this week&apos;s excess to TOIL and overtime
      </Label>
      <span role="status" className="text-muted-foreground ml-auto text-xs leading-5">
        {status}
      </span>
    </div>
  );
}

/** What the switch does with this week's excess, once it is on. */
function ConversionSummary({ figures }: { figures: ThisWeekFigures }) {
  if (figures.excessMinutes <= 0) {
    return <p className="text-muted-foreground">Nothing to convert</p>;
  }
  if (figures.conversion === 'OFF') return null;
  const settlement = figures.settlementDate
    ? formatDate(figures.settlementDate, 'weekdayDayMonth')
    : null;
  return (
    <div className="grid gap-1">
      <dl className="grid gap-1">
        <Figure term="TOIL">{formatDuration(figures.toilMinutes)}</Figure>
        <Figure term="Overtime">
          {overtimeText(figures.overtimePaidMinutes, figures.overtimeUnpaidMinutes)}
        </Figure>
      </dl>
      {settlement ? (
        <p className="text-muted-foreground">
          {figures.conversion === 'APPLIED'
            ? `Applied ${settlement}`
            : `Preview until ${settlement}`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The aside's "This week" panel (feature doc → UI → Aside, This week):
 * credited time against the target, the week's flexi before and after
 * conversion, the conversion switch, and with it on, the TOIL and overtime it
 * makes, as a preview until the settlement day and applied from then; or
 * "Nothing to convert" for a week that is net zero or negative.
 *
 * It loads the week's saved figures and its switch itself; pass `live` for
 * figures that include unsaved rows.
 */
export function ThisWeekPanel({ weekStart, asOf, live, recalculationNotice }: ThisWeekPanelProps) {
  const range = { from: weekStart, to: addDays(weekStart, 7) };
  const summaries = useTimeSummaries({ ...range, groupBy: 'week', asOf }, { enabled: !live });
  const conversions = useExcessConversions(range);
  const headingId = React.useId();

  const retry = () => {
    void summaries.refetch();
    void conversions.refetch();
  };
  const group = summaries.data?.find((g) => g.key === weekStart);
  const figures = live ?? (group ? figuresFromGroup(group) : undefined);

  let body: React.ReactNode;
  if ((!live && summaries.isError) || conversions.isError) {
    body = <LoadError message="We couldn't load this week's totals." onRetry={retry} />;
  } else if ((!live && summaries.isPending) || conversions.isPending) {
    body = <LoadingRows label="Loading this week's totals" rows={3} />;
  } else if (!figures) {
    body = <p className="text-muted-foreground">Nothing is tracked this week.</p>;
  } else {
    const row = conversions.data.find((c) => c.weekStart === weekStart);
    const on = row !== undefined;
    const converting = on && figures.conversion !== 'OFF' && figures.excessMinutes > 0;
    body = (
      <div className="grid gap-3">
        <dl className="grid gap-1">
          <Figure term="Credited">
            {formatDuration(figures.creditedMinutes)} of {formatDuration(figures.targetMinutes)}{' '}
            target
          </Figure>
          <Figure term="Week flexi">{formatFlexi(figures.rawFlexiMinutes)}</Figure>
          {converting ? (
            <Figure term="After conversion">
              {formatFlexi(figures.rawFlexiMinutes - figures.excessMinutes)}
            </Figure>
          ) : null}
        </dl>
        <ConversionSwitchField weekStart={weekStart} row={row} onReload={retry} />
        {on ? <ConversionSummary figures={figures} /> : null}
      </div>
    );
  }

  return (
    <section aria-labelledby={headingId} className="grid gap-3 text-sm">
      <h2 id={headingId} className="text-base font-semibold">
        This week
      </h2>
      {body}
      <p role="status" aria-live="polite" className="text-muted-foreground">
        {recalculationNotice}
      </p>
    </section>
  );
}
