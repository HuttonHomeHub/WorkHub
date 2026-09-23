import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the leave years API. Boots the real Nest app
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

describe.skipIf(!hasDatabase)('Leave years API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/leave-years';

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
    await prisma.leaveYear.deleteMany({ where: { ownerId: { in: [USER, OTHER_USER] } } });
  });

  const server = () => app.getHttpServer();
  const create = (body: Record<string, unknown> = { year: 2026 }) =>
    request(server()).post(base).send(body);

  it('creates a year (201) with the default allowance, owned by the caller', async () => {
    const res = await create().expect(201);
    expect(res.body.data).toMatchObject({
      ownerId: USER,
      year: 2026,
      allowanceMinutes: 14850,
      boughtLeave: false,
      version: 1,
    });
  });

  it('rejects a year outside 2000–2100 and a negative allowance with 422', async () => {
    await create({ year: 1999 }).expect(422);
    await create({ year: 2026, allowanceMinutes: -1 }).expect(422);
  });

  it('rejects a second row for the same year with 409', async () => {
    await create().expect(201);
    await create().expect(409);
  });

  it('lists by year and updates with the version (409 when stale)', async () => {
    await create({ year: 2027 }).expect(201);
    const id = (await create().expect(201)).body.data.id as string;
    const list = await request(server()).get(base).query({ order: 'asc' }).expect(200);
    expect(list.body.data.map((row: { year: number }) => row.year)).toEqual([2026, 2027]);

    const updated = await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, boughtLeave: true, allowanceMinutes: 15000 })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      boughtLeave: true,
      allowanceMinutes: 15000,
      version: 2,
    });
    await request(server()).patch(`${base}/${id}`).send({ version: 1 }).expect(409);
  });

  it('has no delete: a year is edited, never removed', async () => {
    const id = (await create().expect(201)).body.data.id as string;
    await request(server()).delete(`${base}/${id}`).expect(404);
  });

  it("returns the same 404 for a missing row and another owner's", async () => {
    const id = (await create().expect(201)).body.data.id as string;
    await request(server()).get(`${base}/018f0000-0000-7000-8000-000000000000`).expect(404);
    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(server()).get(`${base}/${id}`).expect(404);
    await request(server()).patch(`${base}/${id}`).send({ version: 1 }).expect(404);
    expect((await request(server()).get(base).expect(200)).body.data).toHaveLength(0);
  });

  it('rejects explicit nulls with 422', async () => {
    const id = (await create().expect(201)).body.data.id as string;
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, allowanceMinutes: null })
      .expect(422);
    await request(server())
      .patch(`${base}/${id}`)
      .send({ version: 1, boughtLeave: null })
      .expect(422);
    await create({ year: 2027, boughtLeave: null }).expect(422);
  });
});
