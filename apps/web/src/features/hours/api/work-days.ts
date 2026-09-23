import { addDays } from '@repo/domain';
import type { components } from '@repo/types';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hoursKeys } from './keys';

import { apiClient, unwrap } from '@/lib/api/client';
import { fetchAllPages, unwrapPage } from '@/lib/api/pages';
import { removeFromLists, restoreLists } from '@/lib/query/optimistic';

export type WorkDay = components['schemas']['WorkDayResponseDto'];
export type WorkDayInput = components['schemas']['CreateWorkDayDto'];
export type WorkDayUpdate = components['schemas']['UpdateWorkDayDto'];
export type ExcessConversion = components['schemas']['ExcessConversionResponseDto'];

/**
 * Query keys for the week view's lists, under the tool's `hoursKeys.all`.
 * Kept beside their hooks: `workDays()` and `excessConversions()` are the
 * prefixes any change to those resources invalidates. `excessConversions()`
 * is `hoursKeys.excessConversions()`, so the aside's switch
 * (`useSwitchConversion`) also refreshes the week's Converted column.
 */
export const weekKeys = {
  workDays: () => [...hoursKeys.all, 'work-days'] as const,
  workDaysWeek: (weekStart: string) => [...weekKeys.workDays(), { weekStart }] as const,
  excessConversions: hoursKeys.excessConversions,
  excessConversionsWeek: (weekStart: string) =>
    [...weekKeys.excessConversions(), { weekStart }] as const,
};

/** One week's work days (`[weekStart, weekStart + 7)`), in date order. At most seven rows. */
export function weekWorkDaysQueryOptions(weekStart: string) {
  return queryOptions({
    queryKey: weekKeys.workDaysWeek(weekStart),
    queryFn: () =>
      fetchAllPages<WorkDay>(async (cursor) =>
        unwrapPage(
          await apiClient.GET('/api/v1/work-days', {
            params: {
              query: {
                from: weekStart,
                to: addDays(weekStart, 7),
                sort: 'date',
                order: 'asc',
                ...(cursor ? { cursor } : {}),
              },
            },
          }),
        ),
      ),
  });
}

export function useWeekWorkDays(weekStart: string) {
  return useQuery(weekWorkDaysQueryOptions(weekStart));
}

/** Whether the week's conversion switch is on: its active switch row, or none. */
export function weekConversionQueryOptions(weekStart: string) {
  return queryOptions({
    queryKey: weekKeys.excessConversionsWeek(weekStart),
    queryFn: async () => {
      const { data } = unwrapPage(
        await apiClient.GET('/api/v1/excess-conversions', {
          params: { query: { from: weekStart, to: addDays(weekStart, 1) } },
        }),
      );
      return data[0] ?? null;
    },
  });
}

export function useWeekConversion(weekStart: string) {
  return useQuery(weekConversionQueryOptions(weekStart));
}

/**
 * Everything a day's change can move: the week lists (days, and the switch
 * rows beside them, so the table, its Converted column and the aside are read
 * together) and every computed read-model (summaries, balances).
 */
function invalidateDays(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: weekKeys.workDays() }),
    queryClient.invalidateQueries({ queryKey: weekKeys.excessConversions() }),
    queryClient.invalidateQueries({ queryKey: hoursKeys.computed() }),
  ]);
}

/** Records a new day (409 when the date already has one). */
export function useCreateWorkDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkDayInput) =>
      unwrap(await apiClient.POST('/api/v1/work-days', { body })),
    onSettled: () => invalidateDays(queryClient),
  });
}

/** Edits a day, with optimistic locking (409 when the version is stale). */
export function useUpdateWorkDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: WorkDayUpdate }) =>
      unwrap(await apiClient.PATCH('/api/v1/work-days/{id}', { params: { path: { id } }, body })),
    onSettled: () => invalidateDays(queryClient),
  });
}

/**
 * Clears a day (a soft delete), removing it from the week at once; the caller
 * offers undo through `useRestoreWorkDay`.
 */
export function useDeleteWorkDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.DELETE('/api/v1/work-days/{id}', { params: { path: { id } } });
    },
    onMutate: (id) => removeFromLists(queryClient, weekKeys.workDays(), id),
    onError: (_error, _id, snapshot) => restoreLists(queryClient, snapshot),
    onSettled: () => invalidateDays(queryClient),
  });
}

/** Undoes a clear (`POST …/restore`); the API re-checks the day's rules (422, 409). */
export function useRestoreWorkDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await apiClient.POST('/api/v1/work-days/{id}/restore', { params: { path: { id } } })),
    onSettled: () => invalidateDays(queryClient),
  });
}
