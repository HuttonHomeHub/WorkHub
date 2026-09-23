import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** What `removeFromLists` took out of the cache, for `restoreLists` to put back. */
export type ListSnapshot = [QueryKey, unknown][];

/**
 * The optimistic half of a reversible delete
 * (docs/FRONTEND_ARCHITECTURE.md → Optimistic updates and undo): cancels the
 * matching list queries, snapshots them, and removes the row from every cached
 * list under `listKey`. Lists are arrays of rows with an `id`.
 */
export async function removeFromLists(
  queryClient: QueryClient,
  listKey: QueryKey,
  id: string,
): Promise<ListSnapshot> {
  await queryClient.cancelQueries({ queryKey: listKey });
  const snapshot = queryClient.getQueriesData({ queryKey: listKey });
  queryClient.setQueriesData<{ id: string }[]>({ queryKey: listKey }, (rows) =>
    rows?.filter((row) => row.id !== id),
  );
  return snapshot;
}

/** Puts back what `removeFromLists` removed, when the delete fails. */
export function restoreLists(queryClient: QueryClient, snapshot: ListSnapshot | undefined): void {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
}
