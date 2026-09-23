import { queryOptions, useQuery } from '@tanstack/react-query';

import { hoursKeys, type SummaryGroup, type TimeSummariesQuery } from './keys';

import { apiClient, unwrap } from '@/lib/api/client';

/**
 * Totals by day, week or month (`GET /time-summaries`). The API widens the
 * range to whole groups; `to` is exclusive and at most 366 days after `from`
 * (a 422 otherwise). A computed read-model, so never treated as fresh: every
 * hours mutation invalidates `hoursKeys.computed()`, and a screen showing it
 * refetches when it mounts.
 */
export const timeSummariesQueryOptions = (query: TimeSummariesQuery) =>
  queryOptions({
    queryKey: hoursKeys.summaries(query),
    queryFn: async () =>
      unwrap(await apiClient.GET('/api/v1/time-summaries', { params: { query } })),
    staleTime: 0,
  });

/**
 * `keepPrevious` keeps the last range's rows on screen while a new range
 * loads (a refetch of shown data never goes back to a skeleton). Only for the
 * same grouping: weeks shown as months would be wrong, not just stale.
 */
export function useTimeSummaries(
  query: TimeSummariesQuery,
  { enabled = true, keepPrevious = false }: { enabled?: boolean; keepPrevious?: boolean } = {},
) {
  return useQuery({
    ...timeSummariesQueryOptions(query),
    enabled,
    ...(keepPrevious
      ? {
          placeholderData: (
            previous: SummaryGroup[] | undefined,
            previousQuery: { queryKey: readonly unknown[] } | undefined,
          ) => {
            const previousGroupBy = (
              previousQuery?.queryKey.at(-1) as TimeSummariesQuery | undefined
            )?.groupBy;
            return previousGroupBy === query.groupBy ? previous : undefined;
          },
        }
      : {}),
  });
}
