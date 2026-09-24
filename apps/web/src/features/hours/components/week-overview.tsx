import { addDays, formatDuration } from '@repo/domain';
import { CalendarDays, Clock3, Scale, TrendingUp } from 'lucide-react';

import { useTimeBalances } from '../api/time-balances';
import { useTimeSummaries } from '../api/time-summaries';
import { figuresFromGroup, liveWeekFigures, type ThisWeekFigures } from '../this-week-figures';

import { FlexiValue } from './flexi-value';
import { LoadError } from './request-states';
import type { WeekAsideContext } from './week-view';

import { ProgressBar } from '@/components/ui/progress';
import { StatTile } from '@/components/ui/stat-tile';
import { formatDate } from '@/lib/format';

/** What the conversion does with the week's flexi, in a few words. */
function conversionDetail(figures: ThisWeekFigures): string {
  if (figures.conversion === 'OFF' || figures.convertedMinutes <= 0) {
    return figures.rawFlexiMinutes > 0 ? 'Stays as flexi' : 'This week so far';
  }
  const converted = formatDuration(figures.convertedMinutes);
  if (!figures.settlementDate) return `${converted} converts`;
  const settlement = formatDate(figures.settlementDate, 'weekdayDayMonth');
  return figures.conversion === 'APPLIED'
    ? `${converted} converted ${settlement}`
    : `${converted} converts ${settlement}`;
}

/**
 * The week view's headline figures (docs/features/app-shell-refresh.md →
 * Command centre): four tiles over the table — credited time against the
 * week's target with a bar, the week's flexi and what conversion does with it,
 * the flexi balance, and the leave left in the year with a bar. The week's
 * figures follow unsaved typing (`calculation`); the balances are the API's,
 * as of `asOf`.
 */
export function WeekOverview({ weekStart, asOf, calculation }: WeekAsideContext) {
  const summaries = useTimeSummaries({
    from: weekStart,
    to: addDays(weekStart, 7),
    groupBy: 'week',
    asOf,
  });
  const balances = useTimeBalances(asOf);
  const live = calculation ? liveWeekFigures(calculation.result, weekStart) : null;
  const group = summaries.data?.find((g) => g.key === weekStart);
  const week: ThisWeekFigures | undefined = group
    ? { ...figuresFromGroup(group), ...live }
    : undefined;
  const balance = balances.data?.trackingStart === null ? undefined : balances.data;
  const year = asOf.slice(0, 4);

  const loading = summaries.isPending || balances.isPending;
  return (
    <section aria-label="Headline figures" className="@container">
      {summaries.isError || balances.isError ? (
        <LoadError
          message="We couldn't load this week's figures."
          onRetry={() => {
            void summaries.refetch();
            void balances.refetch();
          }}
        />
      ) : (
        <dl
          aria-busy={loading || undefined}
          className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-4"
        >
          <StatTile
            label="Credited"
            icon={Clock3}
            value={week ? formatDuration(week.creditedMinutes) : undefined}
            meter={
              week ? <ProgressBar value={week.creditedMinutes} max={week.targetMinutes} /> : null
            }
            detail={week ? `of ${formatDuration(week.targetMinutes)} target` : null}
          />
          <StatTile
            label="Week flexi"
            icon={TrendingUp}
            value={week ? <FlexiValue minutes={week.rawFlexiMinutes} /> : undefined}
            detail={week ? conversionDetail(week) : null}
          />
          <StatTile
            label="Flexi balance"
            icon={Scale}
            value={balance ? <FlexiValue minutes={balance.flexiMinutes} /> : undefined}
            detail={balance ? `To the end of ${formatDate(asOf, 'weekdayDayMonth')}` : null}
          />
          <StatTile
            label={`Leave left ${year}`}
            icon={CalendarDays}
            value={
              balance ? (
                <span
                  className={balance.leaveRemainingMinutes < 0 ? 'text-warning-text' : undefined}
                >
                  {formatDuration(balance.leaveRemainingMinutes)}
                </span>
              ) : undefined
            }
            meter={
              balance ? (
                <ProgressBar
                  value={Math.max(0, balance.leaveRemainingMinutes)}
                  max={balance.leaveAllowanceMinutes}
                />
              ) : null
            }
            detail={
              balance
                ? balance.leaveRemainingMinutes < 0
                  ? 'Over allowance'
                  : `of ${formatDuration(balance.leaveAllowanceMinutes)} allowance`
                : null
            }
          />
        </dl>
      )}
    </section>
  );
}
