import { addDays, lastDayOfMonth } from '@repo/domain';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

import type { TimeSummariesQuery } from '../api/keys';
import { timeSummariesQueryOptions, useTimeSummaries } from '../api/time-summaries';
import { summaryRecalculationMessage, type SummarySnapshot } from '../recalculation-message';

import { useRecalculationNotice } from './use-recalculation-notice';

/**
 * Rule 11 for the week view (feature doc → UI → Edits after settlement). The
 * view's own engine run covers only the shown week, so it cannot say how an
 * edit moved the week's TOIL and overtime split or an ended month: those come
 * from `time-summaries`, before and after the save.
 *
 * `begin()` takes the "before" from the cache as an edit starts (a save, a
 * clear or an undo) and returns `finish`, to call once the edit has
 * succeeded: it reads the "after" (the mutation has already re-read the
 * computed figures) and, when something moved, raises the info toast and
 * fills `notice` for the aside's live region. Only a week whose conversion is
 * applied, or that touches an ended month, is compared; the month groups are
 * loaded only for such a week.
 */
export function useWeekRecalculation(weekStart: string, asOf: string) {
  const queryClient = useQueryClient();
  const { notice, announce } = useRecalculationNotice(weekStart);
  const { weekQuery, monthQuery } = React.useMemo(() => {
    const range = { from: weekStart, to: addDays(weekStart, 7), asOf };
    return {
      weekQuery: { ...range, groupBy: 'week' } satisfies TimeSummariesQuery,
      monthQuery: { ...range, groupBy: 'month' } satisfies TimeSummariesQuery,
    };
  }, [weekStart, asOf]);
  // The week's first month ends first, so it has ended whenever either has.
  const touchesEndedMonth = lastDayOfMonth(weekStart) < asOf;

  // Observed here so the "before" is in the cache when an edit starts, and
  // the save's invalidation re-reads them (the panel observes the week too).
  useTimeSummaries(weekQuery);
  useTimeSummaries(monthQuery, { enabled: touchesEndedMonth });

  const begin = React.useCallback((): (() => void) | undefined => {
    const week = weekQuery;
    const months = monthQuery;
    const read = (query: TimeSummariesQuery) =>
      queryClient.getQueryData(timeSummariesQueryOptions(query).queryKey);
    const before: SummarySnapshot = {
      week: read(week)?.find((group) => group.key === week.from),
      months: touchesEndedMonth ? (read(months) ?? []) : [],
    };
    if (!before.week || (before.week.conversion !== 'APPLIED' && !touchesEndedMonth)) {
      return undefined;
    }
    return () => {
      // Fresh after the mutation's invalidation; fetched again only if not.
      const fetch = (query: TimeSummariesQuery) =>
        queryClient.fetchQuery({ ...timeSummariesQueryOptions(query), staleTime: 5_000 });
      void Promise.all([fetch(week), touchesEndedMonth ? fetch(months) : Promise.resolve([])])
        .then(([weekGroups, monthGroups]) => {
          const after: SummarySnapshot = {
            week: weekGroups.find((group) => group.key === week.from),
            months: monthGroups,
          };
          announce(summaryRecalculationMessage(before, after, week.from, week.asOf), week.from);
        })
        // The figures failed to load: the panel shows that, with Retry.
        .catch(() => undefined);
    };
  }, [queryClient, announce, weekQuery, monthQuery, touchesEndedMonth]);

  return { notice, begin };
}
