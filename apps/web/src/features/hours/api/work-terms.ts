import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { hoursKeys, type WorkTerm, type WorkTermInput, type WorkTermUpdate } from './keys';

import { apiClient, unwrap } from '@/lib/api/client';
import { fetchAllPages, unwrapPage } from '@/lib/api/pages';
import { removeFromLists, restoreLists } from '@/lib/query/optimistic';

/** Every active set of work terms, latest `effectiveFrom` first. */
export const workTermsQueryOptions = queryOptions({
  queryKey: hoursKeys.workTerms(),
  queryFn: () =>
    fetchAllPages<WorkTerm>(async (cursor) =>
      unwrapPage(
        await apiClient.GET('/api/v1/work-terms', {
          params: {
            query: { sort: 'effectiveFrom', order: 'desc', ...(cursor ? { cursor } : {}) },
          },
        }),
      ),
    ),
});

export function useWorkTerms() {
  return useQuery(workTermsQueryOptions);
}

/** Adds terms from a Monday (409 when terms already start that Monday). */
export function useCreateWorkTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: WorkTermInput) =>
      unwrap(await apiClient.POST('/api/v1/work-terms', { body })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: hoursKeys.workTerms() }),
  });
}

/** Edits terms in place, with optimistic locking (409 when the version is stale). */
export function useUpdateWorkTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: WorkTermUpdate }) =>
      unwrap(await apiClient.PATCH('/api/v1/work-terms/{id}', { params: { path: { id } }, body })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: hoursKeys.workTerms() }),
  });
}

/**
 * Soft-deletes terms, removing them from the list at once; the caller offers
 * undo through `useRestoreWorkTerm`. A 422 means these are the last terms.
 */
export function useDeleteWorkTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.DELETE('/api/v1/work-terms/{id}', { params: { path: { id } } });
    },
    onMutate: (id) => removeFromLists(queryClient, hoursKeys.workTerms(), id),
    onError: (_error, _id, snapshot) => restoreLists(queryClient, snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: hoursKeys.workTerms() }),
  });
}

/** Undoes a delete (`POST …/restore`); idempotent. */
export function useRestoreWorkTerm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await apiClient.POST('/api/v1/work-terms/{id}/restore', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: hoursKeys.workTerms() }),
  });
}
