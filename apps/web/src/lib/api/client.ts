import type { ApiError, ApiResponse } from '@repo/types';

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

/**
 * Thin typed wrapper over `fetch` for the REST API (`/api/v1/...`). Paths are
 * RELATIVE — the app is always same-origin with the API (the vite dev server
 * and the web container's nginx both proxy /api/*), so no base URL exists.
 * Session cookies are attached automatically (same-origin).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (!response.ok) {
    let error: ApiError['error'] = { code: 'UNKNOWN', message: 'Something went wrong.' };
    try {
      const body = (await response.json()) as Partial<ApiError>;
      if (body.error) error = body.error;
    } catch {
      // Non-JSON error body — keep the generic error.
    }
    throw new ApiRequestError(response.status, error.code, error.message, error.details);
  }

  if (response.status === 204) return undefined as T;
  const body = (await response.json()) as ApiResponse<T>;
  return body.data;
}
