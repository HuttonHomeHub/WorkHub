import { queryOptions, useQuery } from '@tanstack/react-query';

import { apiClient, unwrap } from '@/lib/api/client';

export const accountKeys = {
  all: ['account'] as const,
  me: () => [...accountKeys.all, 'me'] as const,
};

/** The signed-in user's profile from `GET /api/v1/me` (typed by the contract). */
export const meQueryOptions = queryOptions({
  queryKey: accountKeys.me(),
  queryFn: async () => unwrap(await apiClient.GET('/api/v1/me')),
});

export function useMe() {
  return useQuery(meQueryOptions);
}
