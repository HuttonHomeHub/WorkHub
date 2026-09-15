import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Regression test: /api/auth/* is mounted outside the Nest router, so the Nest
 * throttler never applies to it — Better Auth's limiter must. In production
 * the request reaches the API through two hops (the operator's proxy → web
 * nginx), so X-Forwarded-For carries a chain; without trusted proxies Better
 * Auth resolved no client IP and put EVERY client in one shared bucket
 * (3 sign-ins per 10s for the whole app). This proves limits apply and are
 * per client.
 *
 * Requires a database; skipped locally when DATABASE_URL is unset.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

// Web nginx on the Docker network appends its own hop to the chain.
const NGINX_HOP = '172.18.0.2';

describe.skipIf(!hasDatabase)('Authentication rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.LOG_LEVEL ??= 'silent';
    process.env.AUTH_RATE_LIMIT_ENABLED = 'true';
    process.env.AUTH_TRUSTED_PROXIES = '172.16.0.0/12';
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: false, bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const signInFrom = (clientIp: string) =>
    request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .set('X-Forwarded-For', `${clientIp}, ${NGINX_HOP}`)
      .send({ email: 'nobody@example.com', password: 'wrong-password-123' });

  it('limits repeated sign-in attempts from one client (429)', async () => {
    const client = '203.0.113.10';
    for (let attempt = 0; attempt < 3; attempt++) {
      await signInFrom(client).expect(401);
    }
    await signInFrom(client).expect(429);
  });

  it("keeps a separate bucket per client, so one client can't lock out others", async () => {
    await signInFrom('203.0.113.20').expect(401);
    expect((await signInFrom('203.0.113.20')).status).toBe(401);
  });
});
