import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the work terms API. Boots the real Nest app
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

describe.skipIf(!hasDatabase)('Work terms API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/work-terms';

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
    await prisma.workTerm.deleteMany({ where: { ownerId: { in: [USER, OTHER_USER] } } });
  });

  const server = () => app.getHttpServer();
  const create = (body: Record<string, unknown> = { effectiveFrom: '2026-10-05' }) =>
    request(server()).post(base).send(body);
  const MISSING = '018f0000-0000-7000-8000-000000000000';

  it('creates terms (201) with the defaults, owned by the caller', async () => {
    const res = await create().expect(201);
    expect(res.body.data).toMatchObject({
      ownerId: USER,
      effectiveFrom: '2026-10-05',
      targetMinutes: { mon: 450, fri: 450, sat: null, sun: null },
      minimumMinutes: { thu: 450, fri: 330, sat: null },
      breakThresholdMinutes: 360,
      breakMinimumMinutes: 30,
      bandStart: '07:00',
      bandEnd: '19:00',
      paidOvertimeAllowed: false,
      toilMonthlyCapMinutes: 450,
      conversionBlockMinutes: 30,
      leaveDayMaxMinutes: 450,
      flexiCreditCapMinutes: null,
      flexiDebitCapMinutes: null,
      version: 1,
    });
  });

  it('stores a band that is not shifted by BST', async () => {
    const res = await create({
      effectiveFrom: '2026-06-01',
      bandStart: '06:30',
      bandEnd: '20:15',
    }).expect(201);
    const again = await request(server())
      .get(`${base}/${res.body.data.id as string}`)
      .expect(200);
    expect(again.body.data).toMatchObject({ bandStart: '06:30', bandEnd: '20:15' });
  });

  it('rejects a date that is not a Monday with 422', async () => {
    const res = await create({ effectiveFrom: '2026-10-06' }).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects a minimum without a target, and a minimum over its target, with 422', async () => {
    const week = { mon: 450, tue: 450, wed: 450, thu: 450, fri: 450, sat: null, sun: null };
    await create({
      effectiveFrom: '2026-10-05',
      targetMinutes: week,
      minimumMinutes: { ...week, sat: 60 },
    }).expect(422);
    const res = await create({
      effectiveFrom: '2026-10-05',
      targetMinutes: week,
      minimumMinutes: { ...week, mon: 500 },
    }).expect(422);
    expect(res.body.error.details).toContain(
      'minimumMinutes.mon must not exceed targetMinutes.mon',
    );
  });

  it('rejects a reversed band, a zero target and a missing weekday with 422', async () => {
    await create({ effectiveFrom: '2026-10-05', bandStart: '19:00', bandEnd: '07:00' }).expect(422);
    await create({
      effectiveFrom: '2026-10-05',
      targetMinutes: { mon: 0, tue: 450, wed: 450, thu: 450, fri: 450, sat: null, sun: null },
    }).expect(422);
    await create({ effectiveFrom: '2026-10-05', targetMinutes: { mon: 450 } }).expect(422);
  });

  it('rejects a second active row for the same Monday with 409', async () => {
    await create().expect(201);
    const res = await create().expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('lists the caller’s terms, latest first, with pagination metadata', async () => {
    await create({ effectiveFrom: '2026-09-07' }).expect(201);
    await create({ effectiveFrom: '2026-10-05' }).expect(201);
    const res = await request(server()).get(base).expect(200);
    expect(res.body.data.map((row: { effectiveFrom: string }) => row.effectiveFrom)).toEqual([
      '2026-10-05',
      '2026-09-07',
    ]);
    expect(res.body.meta).toMatchObject({ hasMore: false, nextCursor: null });
  });

  it('updates with the version (200), and 409 on a stale version', async () => {
    const id = (await create().expect(201)).body.data.id as string;
    const updated = await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, paidOvertimeAllowed: true, flexiCreditCapMinutes: 2400 })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      paidOvertimeAllowed: true,
      flexiCreditCapMinutes: 2400,
      version: 2,
    });
    await request(server()).patch(`${base}/${id}`).send({ version: 1 }).expect(409);
  });

  it('refuses to delete the last remaining terms (422), then deletes (204) and restores (200)', async () => {
    const first = (await create({ effectiveFrom: '2026-09-07' }).expect(201)).body.data
      .id as string;
    const res = await request(server()).delete(`${base}/${first}`).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');

    await create({ effectiveFrom: '2026-10-05' }).expect(201);
    await request(server()).delete(`${base}/${first}`).expect(204);
    await request(server()).get(`${base}/${first}`).expect(404);
    const restored = await request(server()).post(`${base}/${first}/restore`).expect(200);
    expect(restored.body.data.version).toBe(2);
  });

  it('restores into a Monday that active terms now hold with 409', async () => {
    const first = (await create({ effectiveFrom: '2026-10-05' }).expect(201)).body.data
      .id as string;
    await create({ effectiveFrom: '2026-10-12' }).expect(201);
    await request(server()).delete(`${base}/${first}`).expect(204);
    await create({ effectiveFrom: '2026-10-05' }).expect(201);
    await request(server()).post(`${base}/${first}/restore`).expect(409);
  });

  it("returns the same 404 for a missing row and another owner's, on every route", async () => {
    const id = (await create().expect(201)).body.data.id as string;
    await request(server()).get(`${base}/${MISSING}`).expect(404);

    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(server()).get(`${base}/${id}`).expect(404);
    await request(server()).patch(`${base}/${id}`).send({ version: 1 }).expect(404);
    await request(server()).delete(`${base}/${id}`).expect(404);
    await request(server()).post(`${base}/${id}/restore`).expect(404);
    expect((await request(server()).get(base).expect(200)).body.data).toHaveLength(0);
  });

  it('rejects a malformed id with 400', async () => {
    await request(server()).get(`${base}/not-a-uuid`).expect(400);
  });

  it('rejects an explicit null, an array for the weekday object, and an overflowing version (422)', async () => {
    const id = (await create().expect(201)).body.data.id as string;
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, breakThresholdMinutes: null })
      .expect(422);
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, targetMinutes: [] })
      .expect(422);
    await create({ effectiveFrom: '2026-10-12', targetMinutes: [] }).expect(422);
    await request(server()).patch(`${base}/${id}`).send({ version: 2_147_483_648 }).expect(422);
    // The stored minimums are untouched by the rejected bodies.
    const row = await request(server()).get(`${base}/${id}`).expect(200);
    expect(row.body.data).toMatchObject({ minimumMinutes: { mon: 450, fri: 330 }, version: 1 });
  });

  it('stores a custom conversion block, and keeps it through an update that omits it', async () => {
    const res = await create({ effectiveFrom: '2026-10-05', conversionBlockMinutes: 15 }).expect(
      201,
    );
    expect(res.body.data.conversionBlockMinutes).toBe(15);
    const id = res.body.data.id as string;
    const updated = await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, toilMonthlyCapMinutes: 600 })
      .expect(200);
    expect(updated.body.data).toMatchObject({ conversionBlockMinutes: 15, version: 2 });
    const changed = await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 2, conversionBlockMinutes: 60 })
      .expect(200);
    expect(changed.body.data.conversionBlockMinutes).toBe(60);
  });

  it('rejects a conversion block outside 1–480, a fraction and null (422)', async () => {
    for (const conversionBlockMinutes of [0, 481, 1.5, -30, null]) {
      const res = await create({ effectiveFrom: '2026-10-05', conversionBlockMinutes }).expect(422);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    }
    await create({ effectiveFrom: '2026-10-05', conversionBlockMinutes: 1 }).expect(201);
    await create({ effectiveFrom: '2026-10-12', conversionBlockMinutes: 480 }).expect(201);
    const id = (await create({ effectiveFrom: '2026-10-19' }).expect(201)).body.data.id as string;
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, conversionBlockMinutes: null })
      .expect(422);
    // The database agrees (ck_work_terms_conversion_block_range).
    await expect(
      prisma.workTerm.update({ where: { id }, data: { conversionBlockMinutes: 481 } }),
    ).rejects.toThrow();
  });

  it('still accepts null to clear a flexi cap', async () => {
    const id = (
      await create({ effectiveFrom: '2026-10-05', flexiCreditCapMinutes: 600 }).expect(201)
    ).body.data.id as string;
    const res = await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, flexiCreditCapMinutes: null })
      .expect(200);
    expect(res.body.data.flexiCreditCapMinutes).toBeNull();
  });

  it('keeps the last terms when two deletes race', async () => {
    const a = (await create({ effectiveFrom: '2026-09-07' }).expect(201)).body.data.id as string;
    const b = (await create({ effectiveFrom: '2026-10-05' }).expect(201)).body.data.id as string;
    const results = await Promise.all([
      request(server()).delete(`${base}/${a}`),
      request(server()).delete(`${base}/${b}`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 422]);
    expect((await request(server()).get(base).expect(200)).body.data).toHaveLength(1);
  });

  it("gives another owner's id as a cursor the same empty page as a missing id", async () => {
    const id = (await create().expect(201)).body.data.id as string;
    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await create({ effectiveFrom: '2026-09-07' }).expect(201);
    const foreign = await request(server()).get(base).query({ cursor: id }).expect(200);
    const missing = await request(server())
      .get(base)
      .query({ cursor: '018f0000-0000-7000-8000-000000000000' })
      .expect(200);
    expect(foreign.body.data).toEqual([]);
    expect(missing.body.data).toEqual([]);
  });
});
