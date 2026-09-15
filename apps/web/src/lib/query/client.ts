import { QueryClient } from '@tanstack/react-query';

import { ApiRequestError } from '@/lib/api/client';

/**
 * Query client factory with the project's caching defaults
 * (docs/FRONTEND_ARCHITECTURE.md → Data fetching & caching):
 * fresh-ish lists, bounded cache, retry only transient errors — never 4xx.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiRequestError && error.status < 500) return false;
          return failureCount < 3;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
