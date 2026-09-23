import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hoursKeys, type ExcessConversion } from './keys';

import { ApiRequestError, apiClient, unwrap } from '@/lib/api/client';
import { fetchAllPages, unwrapPage } from '@/lib/api/pages';

/**
 * The weeks whose conversion switch is on, with a week start in
 * `[from, to)` (`GET /excess-conversions`). At most one row a week, so a range
 * of weeks is short and bounded.
 */
export const excessConversionsQueryOptions = (range: { from: string; to: string }) =>
  queryOptions({
    queryKey: hoursKeys.excessConversionList(range),
    queryFn: () =>
      fetchAllPages<ExcessConversion>(async (cursor) =>
        unwrapPage(
          await apiClient.GET('/api/v1/excess-conversions', {
            params: { query: { ...range, limit: 100, ...(cursor ? { cursor } : {}) } },
          }),
        ),
      ),
  });

export function useExcessConversions(range: { from: string; to: string }) {
  return useQuery(excessConversionsQueryOptions(range));
}

/** Switch a week's conversion on (`POST`) or off (`DELETE` the week's row). */
export type ConversionSwitch =
  { on: true; weekStart: string } | { on: false; weekStart: string; row: ExcessConversion };

/**
 * The week's "Convert this week's excess" switch. It is a single reversible
 * toggle (switching back is the undo), so there is no restore. Reaching the
 * state asked for is success even when another tab got there first: a 409 on
 * switching on means it is already on, and a 404 on switching off means it is
 * already off. Every change can move the computed figures.
 */
export function useSwitchConversion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: ConversionSwitch): Promise<void> => {
      try {
        if (change.on) {
          unwrap(
            await apiClient.POST('/api/v1/excess-conversions', {
              body: { weekStart: change.weekStart },
            }),
          );
        } else {
          await apiClient.DELETE('/api/v1/excess-conversions/{id}', {
            params: { path: { id: change.row.id } },
          });
        }
      } catch (error) {
        const reached =
          error instanceof ApiRequestError &&
          ((change.on && error.status === 409) || (!change.on && error.status === 404));
        if (!reached) throw error;
      }
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: hoursKeys.excessConversions() }),
        queryClient.invalidateQueries({ queryKey: hoursKeys.computed() }),
      ]),
  });
}
