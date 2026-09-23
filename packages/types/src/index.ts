/**
 * @repo/types — the contract package shared by the `web` and `api` workspaces
 * (ADR-0017): response envelopes, the API types generated from the OpenAPI
 * spec, and small runtime constants for rules both sides enforce.
 *
 * Keep it free of runtime dependencies. Anything here is the single source of
 * truth for a cross-boundary shape or rule — never duplicate it in an app.
 */

export * from './auth.js';
export * from './hours.js';
export * from './text.js';
export type { components, paths } from './openapi.gen.js';

/** Standard envelope for successful API responses. */
export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/** Standard envelope for API errors (see docs/API.md). */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Cursor-based pagination metadata. */
export interface PageMeta {
  nextCursor: string | null;
  hasMore: boolean;
}
