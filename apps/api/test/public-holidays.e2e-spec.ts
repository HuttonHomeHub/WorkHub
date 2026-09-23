import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the public holidays API. Boots the real Nest app
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

describe.skipIf(!hasDatabase)('Public holidays API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/public-holidays';

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
    await prisma.publicHoliday.deleteMany({ where: { ownerId: { in: [USER, OTHER_USER] } } });
  });

  const server = () => app.getHttpServer();
  const imports = '/api/v1/public-holiday-imports';
  const create = (date = '2026-12-25', name = 'Christmas Day') =>
    request(server()).post(base).send({ date, name });

  it('adds a holiday by hand (201), trimming the name', async () => {
    const res = await request(server())
      .post(base)
      .send({ date: '2026-06-15', name: '  Company day  ' })
      .expect(201);
    expect(res.body.data).toMatchObject({ ownerId: USER, date: '2026-06-15', name: 'Company day' });
  });

  it('rejects a blank name and a bad date with 422, and a second holiday on a date with 409', async () => {
    await create('2026-12-25', '   ').expect(422);
    await create('2026-13-01').expect(422);
    await create().expect(201);
    await create().expect(409);
  });

  it('imports a year (201), then reports nothing new (200)', async () => {
    const first = await request(server()).post(imports).send({ year: 2026 }).expect(201);
    expect(first.body.data.year).toBe(2026);
    expect(first.body.data.added.map((h: { date: string }) => h.date)).toEqual([
      '2026-01-01',
      '2026-04-03',
      '2026-04-06',
      '2026-05-04',
      '2026-05-25',
      '2026-08-31',
      '2026-12-25',
      '2026-12-28',
    ]);
    const again = await request(server()).post(imports).send({ year: 2026 }).expect(200);
    expect(again.body.data.added).toEqual([]);
  });

  it('imports only the missing dates, and re-adds a deleted one', async () => {
    const christmas = (await create().expect(201)).body.data.id as string;
    const res = await request(server()).post(imports).send({ year: 2026 }).expect(201);
    expect(res.body.data.added).toHaveLength(7);

    await request(server()).delete(`${base}/${christmas}`).expect(204);
    const readd = await request(server()).post(imports).send({ year: 2026 }).expect(201);
    expect(readd.body.data.added.map((h: { date: string }) => h.date)).toEqual(['2026-12-25']);
    // The deleted row can no longer be restored over the re-added one.
    await request(server()).post(`${base}/${christmas}/restore`).expect(409);
  });

  it('rejects an import year outside the bundle with 422', async () => {
    await request(server()).post(imports).send({ year: 2041 }).expect(422);
    await request(server()).post(imports).send({ year: '2026' }).expect(422);
  });

  it('lists a date range in date order', async () => {
    await request(server()).post(imports).send({ year: 2026 }).expect(201);
    await request(server()).post(imports).send({ year: 2027 }).expect(201);
    const res = await request(server())
      .get(base)
      .query({ from: '2026-12-01', to: '2027-02-01' })
      .expect(200);
    expect(res.body.data.map((h: { date: string }) => h.date)).toEqual([
      '2026-12-25',
      '2026-12-28',
      '2027-01-01',
    ]);
  });

  it("keeps imports per owner, and hides another owner's holidays behind 404", async () => {
    const id = (await create().expect(201)).body.data.id as string;
    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(server()).get(`${base}/${id}`).expect(404);
    await request(server()).delete(`${base}/${id}`).expect(404);
    await request(server()).post(`${base}/${id}/restore`).expect(404);
    const theirs = await request(server()).post(imports).send({ year: 2026 }).expect(201);
    expect(theirs.body.data.added).toHaveLength(8);
  });

  it('rejects explicit nulls and control characters with 422', async () => {
    const id = (await create().expect(201)).body.data.id as string;
    await request(server()).patch(`${base}/${id}`).send({ version: 1, name: null }).expect(422);
    await request(server()).patch(`${base}/${id}`).send({ version: 1, date: null }).expect(422);
    await create('2026-06-01', 'a\u0000b').expect(422);
    await create('2026-06-01', 'two\nlines').expect(422);
  });

  it('adds each date once when two imports of a year race', async () => {
    const results = await Promise.all([
      request(server()).post(imports).send({ year: 2026 }),
      request(server()).post(imports).send({ year: 2026 }),
    ]);
    const added = results.flatMap((r) => r.body.data.added as unknown[]);
    expect(added).toHaveLength(8);
    expect(results.every((r) => r.status === 200 || r.status === 201)).toBe(true);
    expect((await request(server()).get(base).expect(200)).body.data).toHaveLength(8);
  });
});
