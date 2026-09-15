import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { AccountAuthContext } from '../src/cli/accounts';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * Closed sign-up and server-side account management (ADR-0018), against the
 * real Better Auth wiring: with the default config public sign-up is refused,
 * accounts created through `createAccount` can sign in, and `resetPassword`
 * replaces the password and ends existing sessions.
 *
 * Requires a database; skipped locally when DATABASE_URL is unset.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

function cookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown;
  const cookies = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  return cookies.map((cookie) => cookie.split(';')[0] ?? '').join('; ');
}

describe.skipIf(!hasDatabase)('Closed sign-up and account management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: AccountAuthContext;
  let accounts: typeof import('../src/cli/accounts');

  const email = 'accounts-e2e@example.com';
  const password = 'first-password-123';
  const newPassword = 'second-password-456';

  beforeAll(async () => {
    process.env.LOG_LEVEL ??= 'silent';
    delete process.env.AUTH_SIGNUP_ENABLED; // exercise the default
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { AUTH_INSTANCE } = await import('../src/common/auth/auth.instance');
    const { PrismaService: PrismaServiceToken } = await import('../src/prisma/prisma.service');
    accounts = await import('../src/cli/accounts');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bufferLogs: false, bodyParser: false });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaServiceToken);
    ctx = await app.get<{ $context: Promise<AccountAuthContext> }>(AUTH_INSTANCE).$context;
    await prisma.user.deleteMany({
      where: { email: { in: [email, 'signup-closed@example.com'] } },
    });
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email } });
    await app?.close();
  });

  const signIn = (withPassword: string) =>
    request(app.getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email, password: withPassword });

  it('tells the web client that sign-up is disabled', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/config').expect(200);
    expect(res.body).toEqual({ data: { signUpEnabled: false } });
  });

  it('refuses public sign-up by default', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email: 'signup-closed@example.com', password, name: 'Nope' })
      .expect(400);
    expect(await prisma.user.count({ where: { email: 'signup-closed@example.com' } })).toBe(0);
  });

  it('signs in with an account created on the server', async () => {
    await accounts.createAccount(ctx, { email, name: 'Accounts E2E', password });

    const session = cookieHeader(await signIn(password).expect(200));
    const me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Cookie', session)
      .expect(200);
    expect(me.body.data).toMatchObject({ email, name: 'Accounts E2E' });
  });

  it('resets the password and signs out existing sessions', async () => {
    const oldSession = cookieHeader(await signIn(password).expect(200));

    await accounts.resetPassword(ctx, { email, password: newPassword });

    await request(app.getHttpServer()).get('/api/v1/me').set('Cookie', oldSession).expect(401);
    await signIn(password).expect(401);
    await signIn(newPassword).expect(200);
  });
});
