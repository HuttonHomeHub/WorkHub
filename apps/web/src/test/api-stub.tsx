import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type * as React from 'react';
import { vi } from 'vitest';

import { Toaster } from '@/components/ui/toast';

/** One recorded API call. */
export interface ApiCall {
  method: string;
  path: string;
  search: URLSearchParams;
  body: unknown;
}

type Handler = (call: ApiCall) => { status: number; body?: unknown } | undefined;

/**
 * Stubs `fetch` for component tests of screens that use the typed API client
 * (which calls the global `fetch`). Each handler sees the call and returns a
 * response, or `undefined` to let the next handler try; an unhandled call is a
 * 404. Every call is recorded in `calls`.
 */
export function stubApi(...handlers: Handler[]) {
  const calls: ApiCall[] = [];
  const fetchStub = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const text = await request.text();
    const call: ApiCall = {
      method: request.method,
      path: url.pathname,
      search: url.searchParams,
      body: text ? (JSON.parse(text) as unknown) : undefined,
    };
    calls.push(call);
    for (const handler of handlers) {
      const response = handler(call);
      if (response) {
        return new Response(response.body === undefined ? null : JSON.stringify(response.body), {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchStub);
  return { calls };
}

/** A handler for one method and path (exact, or a pattern). */
export function on(
  method: string,
  path: string | RegExp,
  respond: (call: ApiCall) => { status: number; body?: unknown },
): Handler {
  return (call) => {
    if (call.method !== method) return undefined;
    const matches = typeof path === 'string' ? call.path === path : path.test(call.path);
    return matches ? respond(call) : undefined;
  };
}

/** A list response envelope with no further pages. */
export function page<T>(data: T[]) {
  return { status: 200, body: { data, meta: { nextCursor: null, hasMore: false } } };
}

/** Renders a screen with a fresh query client (no retries) and the toaster. */
export function renderWithApi(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
      <Toaster label="Notifications" dismissLabel="Dismiss notification" />
    </QueryClientProvider>,
  );
}
