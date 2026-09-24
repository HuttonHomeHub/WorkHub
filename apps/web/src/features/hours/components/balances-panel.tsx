import { formatDuration } from '@repo/domain';
import * as React from 'react';

import { useTimeBalances } from '../api/time-balances';

import { Figure } from './figure';
import { FlexiValue } from './flexi-value';
import { LoadError, LoadingRows } from './request-states';

import { formatDate } from '@/lib/format';

export interface BalancesPanelProps {
  /** Today in Europe/London (`londonDateAt(new Date())`); the balances are to the end of it. */
  asOf: string;
}

/** "0:00 paid, 2:00 unpaid" — both, so the paid figure's absence is explicit. */
function overtimeText(paid: number, unpaid: number): string {
  return `${formatDuration(paid)} paid, ${formatDuration(unpaid)} unpaid`;
}

/**
 * The aside's "Balances" panel (feature doc → UI → Aside, Balances): the
 * flexi balance, this month's TOIL against its cap, this year's overtime
 * (paid and unpaid), and the leave left in the year, from `time-balances` as
 * of `asOf`. Flexi shows its direction in words, never colour alone.
 */
export function BalancesPanel({ asOf }: BalancesPanelProps) {
  const balances = useTimeBalances(asOf);
  const headingId = React.useId();

  let body: React.ReactNode;
  if (balances.isPending) {
    body = <LoadingRows label="Loading your balances" rows={4} />;
  } else if (balances.isError) {
    body = (
      <LoadError
        message="We couldn't load your balances."
        onRetry={() => void balances.refetch()}
      />
    );
  } else if (balances.data.trackingStart === null) {
    body = (
      <p className="text-muted-foreground text-small">
        No balances yet. Set your working terms to start tracking hours.
      </p>
    );
  } else {
    const data = balances.data;
    const year = asOf.slice(0, 4);
    body = (
      <dl className="grid gap-1">
        <Figure term="Flexi">
          <FlexiValue minutes={data.flexiMinutes} />
        </Figure>
        <Figure term={`TOIL ${formatDate(asOf, 'month')}`}>
          {formatDuration(data.toilMonthMinutes)} of {formatDuration(data.toilCapMinutes)}
        </Figure>
        <Figure term={`TOIL taken ${formatDate(asOf, 'month')}`}>
          {formatDuration(data.toilTakenMonthMinutes)}
        </Figure>
        <Figure term={`Overtime ${year}`}>
          {overtimeText(data.overtimePaidYearMinutes, data.overtimeUnpaidYearMinutes)}
        </Figure>
        <Figure term={`Leave left ${year}`}>
          {formatDuration(data.leaveRemainingMinutes)}
          {data.leaveRemainingMinutes < 0 ? (
            <span className="text-warning-text"> (over allowance)</span>
          ) : null}
        </Figure>
      </dl>
    );
  }

  return (
    <section
      aria-labelledby={headingId}
      className="bg-card text-body grid gap-3 rounded-xl border p-4 shadow-xs"
    >
      <div className="grid gap-0.5">
        <h2 id={headingId} className="text-h3">
          Balances
        </h2>
        <p className="text-muted-foreground text-meta">
          To the end of {formatDate(asOf, 'weekdayDayMonth')}
        </p>
      </div>
      {body}
    </section>
  );
}
