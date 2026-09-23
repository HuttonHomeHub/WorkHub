import type { PageMeta } from '@repo/types';

import { ApiRequestError } from '@/lib/api/client';

/** Returns a list response's `{ data, meta }` (errors were already thrown by the client). */
export function unwrapPage<T>(result: { data?: { data: T[]; meta: PageMeta } }): {
  data: T[];
  meta: PageMeta;
} {
  if (result.data === undefined) {
    throw new ApiRequestError(500, 'EMPTY_RESPONSE', 'The server returned no data.');
  }
  return result.data;
}

/**
 * The most pages `fetchAllPages` follows. Settings lists are tiny (a few rows a
 * year), so reaching this means something is wrong; stop rather than loop.
 */
const MAX_PAGES = 50;

/**
 * Follows a cursor-paginated list endpoint (docs/API.md → Pagination) to the
 * end and returns every row, for the short, bounded lists a settings screen
 * shows in full. Never use it for a list that grows without bound: page those
 * in the UI instead (docs/FRONTEND_ARCHITECTURE.md → Lists).
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor: string | undefined) => Promise<{ data: T[]; meta: PageMeta }>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { data, meta } = await fetchPage(cursor);
    rows.push(...data);
    if (!meta.hasMore || meta.nextCursor === null) return rows;
    cursor = meta.nextCursor;
  }
  return rows;
}
