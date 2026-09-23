import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the time adjustments API. Boots the real Nest app
 * (global pipe, filter, interceptor, guards) against a real PostgreSQL, and
 * overrides the authentication seam to inject a test principal (the standard
 * NestJS pattern — production auth stays deny-by-default). The real session
 * flow is covered separately by `test/auth.e2e-spec.ts`.
 *
 * Requires a database: run in CI (Postgres service + migrations). Skipped
 * locally when DATABASE_URL is unset. `AppModule` is imported lazily so a
 * skipped run never triggers configuration validation. See docs/TESTING.md.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

// Fresh users per suite: e2e files run in parallel against one database, and
// each suite's cleanup deletes its users (cascading to their rows), so shared
// ids would let one suite delete another's data mid-test.
const USER = randomUUID();
const OTHER_USER = randomUUID();

describe.skipIf(!hasDatabase)('Time adjustments API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/time-adjustments';

  beforeAll(async () => {
    process.env.LOG_LEVEL ??= 'silent';
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { PrismaService: PrismaServiceToken } = await import('../src/prisma/prisma.service');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthContextService)
      .useValue({ resolve: () => Promise.resolve(principal) })
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: false, bodyParser: false });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaServiceToken);
    // owner_id is a foreign key to users.id, so the test principals must exist.
    await prisma.user.createMany({
      data: [
        { id: USER, email: `e2e-owner-${USER}@example.com`, name: 'Owner' },
        { id: OTHER_USER, email: `e2e-other-${OTHER_USER}@example.com`, name: 'Other' },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    // Deleting the users cascades to their rows.
    await prisma?.user.deleteMany({ where: { id: { in: [USER, OTHER_USER] } } });
    await app?.close();
  });

  beforeEach(async () => {
    principal = new Principal(USER, 'owner@example.com', 'Test User');
    await prisma.timeAdjustment.deleteMany({ where: { ownerId: { in: [USER, OTHER_USER] } } });
  });

  const server = () => app.getHttpServer();
  const body = (overrides: Record<string, unknown> = {}) => ({
    effectiveDate: '2026-10-05',
    balance: 'FLEXI',
    minutes: 90,
    reason: 'OPENING_BALANCE',
    ...overrides,
  });
  const create = (overrides: Record<string, unknown> = {}) =>
    request(server()).post(base).send(body(overrides));

  it('creates an adjustment (201), owned by the caller', async () => {
    const res = await create({ minutes: -45, reason: 'FORFEIT' }).expect(201);
    expect(res.body.data).toMatchObject({
      ownerId: USER,
      effectiveDate: '2026-10-05',
      balance: 'FLEXI',
      minutes: -45,
      reason: 'FORFEIT',
      version: 1,
    });
  });

  it('rejects zero minutes, an unknown balance and an impossible date with 422', async () => {
    await create({ minutes: 0 }).expect(422);
    await create({ balance: 'OVERTIME' }).expect(422);
    await create({ effectiveDate: '2026-02-30' }).expect(422);
  });

  it('allows several adjustments on one date and filters by range and balance', async () => {
    await create().expect(201);
    await create({ balance: 'TOIL' }).expect(201);
    await create({ effectiveDate: '2026-11-02' }).expect(201);
    const october = await request(server())
      .get(base)
      .query({ from: '2026-10-01', to: '2026-11-01', balance: 'FLEXI' })
      .expect(200);
    expect(october.body.data).toHaveLength(1);
    await request(server()).get(base).query({ from: 'yesterday' }).expect(422);
  });

  it('updates with the version, soft-deletes and restores', async () => {
    const id = (await create().expect(201)).body.data.id as string;
    await request(server()).patch(`${base}/${id}`).send({ version: 1, minutes: 120 }).expect(200);
    await request(server()).patch(`${base}/${id}`).send({ version: 1, minutes: 60 }).expect(409);
    await request(server()).delete(`${base}/${id}`).expect(204);
    await request(server()).get(`${base}/${id}`).expect(404);
    const restored = await request(server()).post(`${base}/${id}/restore`).expect(200);
    expect(restored.body.data).toMatchObject({ minutes: 120, version: 3 });
  });

  it("returns the same 404 for another owner's adjustment on every route", async () => {
    const id = (await create().expect(201)).body.data.id as string;
    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(server()).get(`${base}/${id}`).expect(404);
    await request(server()).patch(`${base}/${id}`).send({ version: 1 }).expect(404);
    await request(server()).delete(`${base}/${id}`).expect(404);
    await request(server()).post(`${base}/${id}/restore`).expect(404);
  });

  it('rejects explicit nulls with 422', async () => {
    const id = (await create().expect(201)).body.data.id as string;
    for (const field of ['minutes', 'balance', 'effectiveDate', 'reason']) {
      await request(server())
        .patch(`${base}/${id}`)
        .send({ version: 1, [field]: null })
        .expect(422);
    }
  });
});
