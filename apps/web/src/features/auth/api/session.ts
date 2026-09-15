import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { authClient } from './auth-client';

export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** The single source of truth for auth state (docs/FRONTEND_ARCHITECTURE.md). */
export const sessionQueryOptions = queryOptions({
  queryKey: authKeys.session(),
  queryFn: async (): Promise<SessionUser | null> => {
    const { data } = await authClient.getSession();
    if (!data) return null;
    return { id: data.user.id, email: data.user.email, name: data.user.name };
  },
  // Sessions change rarely; guards re-validate on navigation via ensureQueryData.
  staleTime: 60_000,
});

export function useSession() {
  return useQuery(sessionQueryOptions);
}

/** Used by route guards (beforeLoad) where hooks are unavailable. */
export async function ensureSession(queryClient: QueryClient): Promise<SessionUser | null> {
  return queryClient.ensureQueryData(sessionQueryOptions);
}

interface Credentials {
  email: string;
  password: string;
}

/** Throw Better Auth client errors as real errors so mutations surface them. */
function unwrap<T extends { error: { message?: string | undefined } | null }>(result: T): T {
  if (result.error) {
    throw new Error(result.error.message ?? 'Authentication failed.');
  }
  return result;
}

/**
 * Auth transitions DROP every cached query, not merely invalidate the session:
 * - route guards use `ensureQueryData`, which returns any cached value (even a
 *   stale `null`) — a sign-in followed by navigation would otherwise still see
 *   "no session" and bounce back to the sign-in page;
 * - all other server state is per-user (ADR-0016), so data cached for one
 *   account must never be shown after switching to another.
 */
function dropSession(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.removeQueries();
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: Credentials) =>
      unwrap(await authClient.signIn.email(credentials)),
    onSuccess: () => dropSession(queryClient),
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Credentials & { name: string }) =>
      unwrap(await authClient.signUp.email(input)),
    onSuccess: () => dropSession(queryClient),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await authClient.signOut()),
    onSuccess: () => dropSession(queryClient),
  });
}
