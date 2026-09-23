import type { components } from '@repo/types';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient, unwrap } from '@/lib/api/client';
import { fetchAllPages, unwrapPage } from '@/lib/api/pages';
import { removeFromLists, restoreLists } from '@/lib/query/optimistic';

export type PublicHoliday = components['schemas']['PublicHolidayResponseDto'];
export type PublicHolidayInput = components['schemas']['CreatePublicHolidayDto'];

/** Query keys for public holidays, a core entity any tool may read (ADR-0020 §3). */
export const publicHolidayKeys = {
  all: ['core', 'public-holidays'] as const,
  lists: () => [...publicHolidayKeys.all, 'list'] as const,
  year: (year: number) => [...publicHolidayKeys.lists(), { year }] as const,
};

/** The owner's public holidays in one calendar year, earliest first. */
export function publicHolidaysQueryOptions(year: number) {
  return queryOptions({
    queryKey: publicHolidayKeys.year(year),
    queryFn: () =>
      fetchAllPages<PublicHoliday>(async (cursor) =>
        unwrapPage(
          await apiClient.GET('/api/v1/public-holidays', {
            params: {
              query: {
                from: `${String(year)}-01-01`,
                to: `${String(year + 1)}-01-01`,
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

export function usePublicHolidays(year: number) {
  return useQuery(publicHolidaysQueryOptions(year));
}

/** Adds one holiday by hand (409 when there is already one on that date). */
export function useCreatePublicHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: PublicHolidayInput) =>
      unwrap(await apiClient.POST('/api/v1/public-holidays', { body })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: publicHolidayKeys.lists() }),
  });
}

/**
 * Adds the year's bundled England and Wales bank holidays the owner does not
 * already have; resolves to the holidays added (none when the year is complete).
 */
export function useImportPublicHolidays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) =>
      unwrap(await apiClient.POST('/api/v1/public-holiday-imports', { body: { year } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: publicHolidayKeys.lists() }),
  });
}

/** Soft-deletes a holiday at once; the caller offers undo with `useRestorePublicHoliday`. */
export function useDeletePublicHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.DELETE('/api/v1/public-holidays/{id}', { params: { path: { id } } });
    },
    onMutate: (id) => removeFromLists(queryClient, publicHolidayKeys.lists(), id),
    onError: (_error, _id, snapshot) => restoreLists(queryClient, snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: publicHolidayKeys.lists() }),
  });
}

/** Undoes a delete (`POST …/restore`); idempotent. */
export function useRestorePublicHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await apiClient.POST('/api/v1/public-holidays/{id}/restore', { params: { path: { id } } }),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: publicHolidayKeys.lists() }),
  });
}
