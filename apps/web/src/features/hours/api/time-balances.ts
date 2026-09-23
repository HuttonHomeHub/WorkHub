import { queryOptions, useQuery } from '@tanstack/react-query';

import { hoursKeys } from './keys';

import { apiClient, unwrap } from '@/lib/api/client';

/**
 * Balances as of a date (`GET /time-balances`). Computed from every hours row
 * and the owner's public holidays, so it is never treated as fresh: it
 * refetches whenever a screen showing it mounts (core's holiday changes cannot
 * invalidate an hours key).
 */
export const timeBalancesQueryOptions = (asOf: string) =>
  queryOptions({
    queryKey: hoursKeys.balances(asOf),
    queryFn: async () =>
      unwrap(await apiClient.GET('/api/v1/time-balances', { params: { query: { asOf } } })),
    staleTime: 0,
  });

export function useTimeBalances(asOf: string) {
  return useQuery(timeBalancesQueryOptions(asOf));
}
