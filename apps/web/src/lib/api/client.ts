import type { ApiError, paths } from '@repo/types';
import createClient, { type Middleware } from 'openapi-fetch';

/**
 * A typed error thrown for non-2xx API responses, carrying the standard error
 * envelope (docs/API.md). 4xx codes are expected domain outcomes; 5xx are
 * incidents (see docs/FRONTEND_ARCHITECTURE.md → Error handling).
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Turns every non-2xx response into an {@link ApiRequestError}. */
const throwOnErrorResponse: Middleware = {
  async onResponse({ response }) {
    if (response.ok) return undefined;
    let error: ApiError['error'] = { code: 'UNKNOWN', message: 'Something went wrong.' };
    try {
      const body = (await response.clone().json()) as Partial<ApiError>;
      if (body.error) error = body.error;
    } catch {
      // Non-JSON error body — keep the generic error.
    }
    throw new ApiRequestError(response.status, error.code, error.message, error.details);
  },
};

/**
 * The typed REST client (ADR-0017). Paths, params, bodies, and responses are
 * checked against the types generated from the API's OpenAPI contract
 * (`pnpm contract:generate`). The app is always same-origin with the API (the
 * Vite dev server and the web container's nginx proxy /api/*), so session
 * cookies are sent automatically and no API URL is baked into the bundle.
 *
 * Use it only inside feature `api/` query/mutation hooks — components never
 * call it directly (docs/FRONTEND_ARCHITECTURE.md → Data fetching).
 */
export const apiClient = createClient<paths>({
  baseUrl: window.location.origin,
  // Late-bound so tests can stub the global fetch.
  fetch: (request) => fetch(request),
});
apiClient.use(throwOnErrorResponse);

/**
 * Returns the payload from the standard `{ data }` envelope. Errors have
 * already been thrown by the client middleware.
 */
export function unwrap<T>(result: { data?: { data: T } }): T {
  if (result.data === undefined) {
    throw new ApiRequestError(500, 'EMPTY_RESPONSE', 'The server returned no data.');
  }
  return result.data.data;
}
