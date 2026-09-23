import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the work days API. Boots the real Nest app
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

describe.skipIf(!hasDatabase)('Work days API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/work-days';

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
    const owners = { ownerId: { in: [USER, OTHER_USER] } };
    await prisma.workDay.deleteMany({ where: owners });
    await prisma.workTerm.deleteMany({ where: owners });
    await prisma.publicHoliday.deleteMany({ where: owners });
    // Default terms from Monday 5 October 2026 (the tracking start).
    await request(app.getHttpServer())
      .post('/api/v1/work-terms')
      .send({ effectiveFrom: '2026-10-05' })
      .expect(201);
  });

  const server = () => app.getHttpServer();
  const shift = (
    date: string,
    startsAt: string,
    endsAt: string,
    extra: Record<string, unknown> = {},
  ) =>
    request(server())
      .post(base)
      .send({ date, startsAt, endsAt, breakMinutes: 30, ...extra });
  // Monday 5 October 2026, 08:00–16:30 BST.
  const monday = () => shift('2026-10-05', '2026-10-05T07:00:00.000Z', '2026-10-05T15:30:00.000Z');

  it('records a day (201), owned by the caller, with instants in Z form', async () => {
    const res = await monday().expect(201);
    expect(res.body.data).toMatchObject({
      ownerId: USER,
      date: '2026-10-05',
      startsAt: '2026-10-05T07:00:00.000Z',
      endsAt: '2026-10-05T15:30:00.000Z',
      breakMinutes: 30,
      leaveMinutes: 0,
      toilTakenMinutes: 0,
      bankHolidayWorked: false,
      version: 1,
    });
  });

  it('records a leave-only day with no times', async () => {
    await request(server()).post(base).send({ date: '2026-10-06', leaveMinutes: 450 }).expect(201);
  });

  it('rejects a second row for a date with 409', async () => {
    await monday().expect(201);
    const res = await monday().expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a day before the tracking start, and bad times, with 422', async () => {
    const early = await shift(
      '2026-10-02',
      '2026-10-02T07:00:00.000Z',
      '2026-10-02T15:00:00.000Z',
    ).expect(422);
    expect(early.body.error.details[0]).toMatch(/tracking start/);
    await shift('2026-10-05', '2026-10-05T07:00:00.000Z', '2026-10-05T06:00:00.000Z').expect(422);
    await shift('2026-10-05', '2026-10-05T07:00:00.000Z', '2026-10-06T07:01:00.000Z').expect(422);
    await shift('2026-10-05', '2026-10-05T07:00:00', '2026-10-05T15:00:00').expect(422); // no Z
    await request(server())
      .post(base)
      .send({ date: '2026-10-05', startsAt: '2026-10-05T07:00:00.000Z' })
      .expect(422);
    // Starts on the previous London date.
    await shift('2026-10-06', '2026-10-05T22:30:00.000Z', '2026-10-06T06:00:00.000Z').expect(422);
  });

  it('accepts a night shift across the October clock change', async () => {
    // Sat 24 Oct 22:00 BST (21:00Z) to Sun 25 Oct 06:00 GMT: 9 hours.
    const res = await shift(
      '2026-10-24',
      '2026-10-24T21:00:00.000Z',
      '2026-10-25T06:00:00.000Z',
    ).expect(201);
    expect(res.body.data.endsAt).toBe('2026-10-25T06:00:00.000Z');
  });

  it("refuses a night shift that runs into the next day's start (422), either way round", async () => {
    await shift('2026-10-06', '2026-10-06T05:00:00.000Z', '2026-10-06T13:00:00.000Z').expect(201);
    const res = await shift(
      '2026-10-05',
      '2026-10-05T20:00:00.000Z',
      '2026-10-06T05:30:00.000Z',
    ).expect(422);
    expect(res.body.error.details).toContain("endsAt must not run into the next day's start");

    await shift('2026-10-07', '2026-10-07T20:00:00.000Z', '2026-10-08T06:00:00.000Z').expect(201);
    await shift('2026-10-08', '2026-10-08T05:00:00.000Z', '2026-10-08T12:00:00.000Z').expect(422);
  });

  it("applies rule 4's limits (422)", async () => {
    const leave = (date: string, body: Record<string, unknown>) =>
      request(server())
        .post(base)
        .send({ date, ...body });
    await leave('2026-10-05', { leaveMinutes: 460 }).expect(422);
    await leave('2026-10-05', { leaveMinutes: 300, toilTakenMinutes: 200 }).expect(422);
    await leave('2026-10-10', { leaveMinutes: 60 }).expect(422); // Saturday
    await request(server()).post('/api/v1/public-holiday-imports').send({ year: 2026 }).expect(201);
    await leave('2026-12-25', { leaveMinutes: 60 }).expect(422);
    await leave('2026-12-25', { leaveMinutes: 60, bankHolidayWorked: true }).expect(201);
    await leave('2026-12-24', { bankHolidayWorked: true }).expect(422);
  });

  it('lists a date range in date order', async () => {
    await shift('2026-10-07', '2026-10-07T07:00:00.000Z', '2026-10-07T15:00:00.000Z').expect(201);
    await monday().expect(201);
    await shift('2026-10-12', '2026-10-12T07:00:00.000Z', '2026-10-12T15:00:00.000Z').expect(201);
    const res = await request(server())
      .get(base)
      .query({ from: '2026-10-05', to: '2026-10-12' })
      .expect(200);
    expect(res.body.data.map((d: { date: string }) => d.date)).toEqual([
      '2026-10-05',
      '2026-10-07',
    ]);
  });

  it('updates with the version (409 when stale), clears the times with null, and validates the merge', async () => {
    const id = (await monday().expect(201)).body.data.id as string;
    const cleared = await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, startsAt: null, endsAt: null, breakMinutes: 0, leaveMinutes: 450 })
      .expect(200);
    expect(cleared.body.data).toMatchObject({
      startsAt: null,
      endsAt: null,
      leaveMinutes: 450,
      version: 2,
    });
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, leaveMinutes: 0 })
      .expect(409);
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 2, toilTakenMinutes: 30 })
      .expect(422);
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 2, leaveMinutes: null })
      .expect(422);
  });

  it('clears a day (204), restores it (200), and restore into a re-entered date is 409', async () => {
    const id = (await monday().expect(201)).body.data.id as string;
    await request(server()).delete(`${base}/${id}`).expect(204);
    await request(server()).get(`${base}/${id}`).expect(404);
    const restored = await request(server()).post(`${base}/${id}/restore`).expect(200);
    expect(restored.body.data.version).toBe(2);

    await request(server()).delete(`${base}/${id}`).expect(204);
    await monday().expect(201);
    await request(server()).post(`${base}/${id}/restore`).expect(409);
  });

  it("returns the same 404 for another owner's day on every route", async () => {
    const id = (await monday().expect(201)).body.data.id as string;
    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(server()).get(`${base}/${id}`).expect(404);
    await request(server()).patch(`${base}/${id}`).send({ version: 1 }).expect(404);
    await request(server()).delete(`${base}/${id}`).expect(404);
    await request(server()).post(`${base}/${id}/restore`).expect(404);
    expect((await request(server()).get(base).expect(200)).body.data).toHaveLength(0);
  });

  it('re-checks a restored day against its neighbours (422)', async () => {
    const night = await shift(
      '2026-10-05',
      '2026-10-05T20:00:00.000Z',
      '2026-10-06T05:00:00.000Z',
    ).expect(201);
    const id = night.body.data.id as string;
    await request(server()).delete(`${base}/${id}`).expect(204);
    await shift('2026-10-06', '2026-10-06T04:00:00.000Z', '2026-10-06T12:00:00.000Z').expect(201);
    await request(server()).post(`${base}/${id}/restore`).expect(422);
  });
});
