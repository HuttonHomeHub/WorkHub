import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hoursKeys, type LeaveYear, type LeaveYearInput } from './keys';

import { apiClient, unwrap } from '@/lib/api/client';
import { fetchAllPages, unwrapPage } from '@/lib/api/pages';

/** Every leave year the owner has set up, latest first. */
export const leaveYearsQueryOptions = queryOptions({
  queryKey: hoursKeys.leaveYears(),
  queryFn: () =>
    fetchAllPages<LeaveYear>(async (cursor) =>
      unwrapPage(
        await apiClient.GET('/api/v1/leave-years', {
          params: { query: { sort: 'year', order: 'desc', ...(cursor ? { cursor } : {}) } },
        }),
      ),
    ),
});

export function useLeaveYears() {
  return useQuery(leaveYearsQueryOptions);
}

/** Sets up a year (409 when it already exists). */
export function useCreateLeaveYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LeaveYearInput) =>
      unwrap(await apiClient.POST('/api/v1/leave-years', { body })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: hoursKeys.leaveYears() }),
  });
}

/**
 * Changes a year's allowance or bought leave, with optimistic locking (409
 * when the version is stale). The saved row replaces the cached one at once,
 * so the next change sends the new version.
 */
export function useUpdateLeaveYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      row,
      ...changes
    }: {
      row: LeaveYear;
      allowanceMinutes?: number;
      boughtLeave?: boolean;
    }) =>
      unwrap(
        await apiClient.PATCH('/api/v1/leave-years/{id}', {
          params: { path: { id: row.id } },
          body: {
            allowanceMinutes: changes.allowanceMinutes ?? row.allowanceMinutes,
            boughtLeave: changes.boughtLeave ?? row.boughtLeave,
            version: row.version,
          },
        }),
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<LeaveYear[]>(hoursKeys.leaveYears(), (rows) =>
        rows?.map((row) => (row.id === saved.id ? saved : row)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: hoursKeys.leaveYears() }),
  });
}
