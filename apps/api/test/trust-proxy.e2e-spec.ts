import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { AppConfigService } from '../src/config/app-config.service';

/**
 * Regression test: the API set Express's `trust proxy` to `true`, so `req.ip`
 * — the Nest throttler's key — came from whatever X-Forwarded-For a client
 * sent. Rotating that header gave every request a fresh rate-limit bucket.
 * Forwarded addresses must only count when the connecting peer is a
 * configured proxy (AUTH_TRUSTED_PROXIES).
 *
 * Supertest connects from loopback, which plays the untrusted client (the
 * production default trusts only the Docker networks) or, when listed, the
 * trusted proxy.
 *
 * Requires a database; skipped locally when DATABASE_URL is unset.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const LIMIT = 3;

describe.skipIf(!hasDatabase)('Forwarded client addresses (e2e)', () => {
  let app: INestApplication | undefined;

  beforeAll(() => {
    process.env.LOG_LEVEL ??= 'silent';
    process.env.RATE_LIMIT_LIMIT = String(LIMIT);
    process.env.AUTH_TRUSTED_PROXIES = '172.16.0.0/12';
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  /** Boots the app; `trustedProxies` overrides the configured list when given. */
  async function startApp(trustedProxies?: string[]): Promise<INestApplication> {
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { AppConfigService: AppConfigServiceToken } =
      await import('../src/config/app-config.service');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    if (trustedProxies) {
      vi.spyOn(
        moduleRef.get<AppConfigService>(AppConfigServiceToken),
        'authTrustedProxies',
        'get',
      ).mockReturnValue(trustedProxies);
    }
    app = moduleRef.createNestApplication({ bufferLogs: false, bodyParser: false });
    configureApp(app);
    await app.init();
    return app;
  }

  // Throttled before authentication, so an anonymous request is 401 until the
  // client's bucket is spent, then 429.
  const getMe = (target: INestApplication, forwardedFor: string) =>
    request(target.getHttpServer()).get('/api/v1/me').set('X-Forwarded-For', forwardedFor);

  it('ignores X-Forwarded-For from an untrusted peer, so spoofed addresses share one bucket', async () => {
    const target = await startApp();

    for (let attempt = 0; attempt < LIMIT; attempt++) {
      await getMe(target, `203.0.113.${attempt + 1}`).expect(401);
    }
    await getMe(target, '203.0.113.99').expect(429);
  });

  it('uses the forwarded client address when the peer is a trusted proxy', async () => {
    const target = await startApp(['loopback']);

    for (let attempt = 0; attempt < LIMIT; attempt++) {
      await getMe(target, '198.51.100.1').expect(401);
    }
    await getMe(target, '198.51.100.1').expect(429);
    expect((await getMe(target, '198.51.100.2')).status).toBe(401);
  });
});
