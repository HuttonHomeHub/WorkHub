import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hoursKeys, type TimeAdjustment, type TimeAdjustmentInput } from './keys';

import { apiClient, unwrap } from '@/lib/api/client';
import { fetchAllPages, unwrapPage } from '@/lib/api/pages';
import { removeFromLists, restoreLists } from '@/lib/query/optimistic';

/** Every active time adjustment, latest effective date first. */
export const timeAdjustmentsQueryOptions = queryOptions({
  queryKey: hoursKeys.timeAdjustments(),
  queryFn: () =>
    fetchAllPages<TimeAdjustment>(async (cursor) =>
      unwrapPage(
        await apiClient.GET('/api/v1/time-adjustments', {
          params: {
            query: { sort: 'effectiveDate', order: 'desc', ...(cursor ? { cursor } : {}) },
          },
        }),
      ),
    ),
});

export function useTimeAdjustments() {
  return useQuery(timeAdjustmentsQueryOptions);
}

export function useCreateTimeAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: TimeAdjustmentInput) =>
      unwrap(await apiClient.POST('/api/v1/time-adjustments', { body })),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: hoursKeys.timeAdjustments() }),
        queryClient.invalidateQueries({ queryKey: hoursKeys.computed() }),
      ]),
  });
}

/** Soft-deletes an adjustment at once; the caller offers undo with `useRestoreTimeAdjustment`. */
export function useDeleteTimeAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.DELETE('/api/v1/time-adjustments/{id}', { params: { path: { id } } });
    },
    onMutate: (id) => removeFromLists(queryClient, hoursKeys.timeAdjustments(), id),
    onError: (_error, _id, snapshot) => restoreLists(queryClient, snapshot),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: hoursKeys.timeAdjustments() }),
        queryClient.invalidateQueries({ queryKey: hoursKeys.computed() }),
      ]),
  });
}

/** Undoes a delete (`POST …/restore`); idempotent. */
export function useRestoreTimeAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await apiClient.POST('/api/v1/time-adjustments/{id}/restore', {
          params: { path: { id } },
        }),
      ),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: hoursKeys.timeAdjustments() }),
        queryClient.invalidateQueries({ queryKey: hoursKeys.computed() }),
      ]),
  });
}
