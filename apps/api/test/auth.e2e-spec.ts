import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from '@repo/types';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end tests for the real authentication flow (Better Auth, ADR-0003):
 * open email/password signup → session cookie → protected route → sign-out.
 * Unlike the reference e2e (which overrides the auth seam), this exercises the
 * production wiring: the /api/auth/* handler, cookie session validation in
 * AuthContextService, and the deny-by-default guard.
 *
 * Requires a database (CI: Postgres service + `prisma migrate deploy`);
 * skipped locally when DATABASE_URL is unset.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

/** supertest types `set-cookie` as a string; at runtime it is an array. */
function setCookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown;
  if (Array.isArray(raw)) return raw as string[];
  return typeof raw === 'string' ? [raw] : [];
}

/** Collapse Set-Cookie headers into a Cookie request header. */
function toCookieHeader(res: request.Response): string {
  return setCookies(res)
    .map((cookie) => cookie.split(';')[0] ?? '')
    .join('; ');
}

describe.skipIf(!hasDatabase)('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = 'auth-e2e@example.com';
  const password = 'a-strong-password-123';

  beforeAll(async () => {
    process.env.LOG_LEVEL ??= 'silent';
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { PrismaService: PrismaServiceToken } = await import('../src/prisma/prisma.service');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: false, bodyParser: false });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaServiceToken);
    // Idempotent across runs: remove the test user (cascades sessions/accounts).
    await prisma.user.deleteMany({ where: { email } });
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email } });
    await app?.close();
  });

  it('denies unauthenticated access to protected routes (401)', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
  });

  it('serves the health probes publicly at the root', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
  });

  it('signs up, holds a session, and signs out', async () => {
    // Open signup (ADR-0016).
    const signUp = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password, name: 'Auth E2E' })
      .expect(200);
    const cookies = setCookies(signUp);
    expect(cookies.some((c) => c.includes('better-auth.session_token'))).toBe(true);

    // The session cookie authenticates a session lookup...
    const cookieHeader = toCookieHeader(signUp);
    const session = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookieHeader)
      .expect(200);
    expect(session.body.user).toMatchObject({ email, name: 'Auth E2E' });

    // ...and signing out invalidates it.
    await request(app.getHttpServer())
      .post('/api/auth/sign-out')
      .set('Cookie', cookieHeader)
      .expect(200);
    const after = await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookieHeader)
      .expect(200);
    expect(after.body).toBeFalsy();
  });

  it('signs in with email/password and reaches a protected route', async () => {
    const signIn = await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password })
      .expect(200);
    const cookieHeader = toCookieHeader(signIn);

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', cookieHeader)
      .expect(200);
    expect(res.body.data).toMatchObject({ email, name: 'Auth E2E' });
  });

  it('rejects a wrong password (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'wrong-password-123' })
      .expect(401);
  });

  // Shared rules (@repo/types, ADR-0017) are enforced by the API, not only the web form.
  it('rejects a sign-up whose name breaks the shared length rule (400)', async () => {
    const tooLong = 'x'.repeat(USER_NAME_MAX_LENGTH + 1);
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: 'auth-e2e-long-name@example.com', password, name: tooLong })
      .expect(400);
    expect(await prisma.user.count({ where: { email: 'auth-e2e-long-name@example.com' } })).toBe(0);
  });

  it('rejects a password shorter than the shared minimum (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({
        email: 'auth-e2e-short-password@example.com',
        password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1),
        name: 'Short',
      })
      .expect(400);
  });
});
