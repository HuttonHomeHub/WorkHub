import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiRequestError, unwrap } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls same-origin paths and unwraps the { data } envelope', async () => {
    const fetchMock = vi.fn((_request: Request) =>
      Promise.resolve(
        jsonResponse(200, { data: { id: '1', email: 'user@example.com', name: 'User' } }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const me = unwrap(await apiClient.GET('/api/v1/me'));

    expect(me).toEqual({ id: '1', email: 'user@example.com', name: 'User' });
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request?.url).toBe(`${window.location.origin}/api/v1/me`);
  });

  it('throws ApiRequestError carrying the standard error envelope', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        jsonResponse(401, { error: { code: 'UNAUTHENTICATED', message: 'Unauthorized' } }),
      ),
    );

    const error = await apiClient.GET('/api/v1/me').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
  });

  it('falls back to a generic error for non-JSON error bodies', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('Bad gateway', { status: 502 })));

    await expect(apiClient.GET('/api/v1/me')).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN',
    });
  });
});
