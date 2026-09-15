import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query';

import { authKeys } from './session';

import { apiClient, unwrap } from '@/lib/api/client';

/** Public settings for the signed-out screens: `GET /api/v1/config` (ADR-0018). */
export const authConfigQueryOptions = queryOptions({
  queryKey: [...authKeys.all, 'config'] as const,
  queryFn: async () => unwrap(await apiClient.GET('/api/v1/config')),
  // Server configuration only changes on redeploy.
  staleTime: Infinity,
});

export function useAuthConfig() {
  return useQuery(authConfigQueryOptions);
}

/** Used by route guards (beforeLoad) where hooks are unavailable. */
export function ensureAuthConfig(queryClient: QueryClient) {
  return queryClient.ensureQueryData(authConfigQueryOptions);
}
