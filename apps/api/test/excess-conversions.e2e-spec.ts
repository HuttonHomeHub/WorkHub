import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the excess conversions API. Boots the real Nest app
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

describe.skipIf(!hasDatabase)('Excess conversions API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/excess-conversions';

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
    await prisma.excessConversion.deleteMany({ where: { ownerId: { in: [USER, OTHER_USER] } } });
  });

  const server = () => app.getHttpServer();
  const on = (weekStart = '2026-10-05') => request(server()).post(base).send({ weekStart });

  it('switches a week on (201) and lists it', async () => {
    const res = await on().expect(201);
    expect(res.body.data).toMatchObject({ ownerId: USER, weekStart: '2026-10-05' });
    const list = await request(server())
      .get(base)
      .query({ from: '2026-10-01', to: '2026-11-01' })
      .expect(200);
    expect(list.body.data.map((w: { weekStart: string }) => w.weekStart)).toEqual(['2026-10-05']);
  });

  it('rejects a date that is not a Monday with 422, and a week already on with 409', async () => {
    await on('2026-10-06').expect(422);
    await on().expect(201);
    await on().expect(409);
  });

  it('switches off (204), and on again with a new row', async () => {
    const id = (await on().expect(201)).body.data.id as string;
    await request(server()).delete(`${base}/${id}`).expect(204);
    await request(server()).delete(`${base}/${id}`).expect(404);
    const again = await on().expect(201);
    expect(again.body.data.id).not.toBe(id);
  });

  it('has no update, get or restore routes', async () => {
    const id = (await on().expect(201)).body.data.id as string;
    await request(server()).get(`${base}/${id}`).expect(404);
    await request(server()).patch(`${base}/${id}`).send({}).expect(404);
    await request(server()).post(`${base}/${id}/restore`).expect(404);
  });

  it("returns the same 404 for another owner's switch, and never lists it", async () => {
    const id = (await on().expect(201)).body.data.id as string;
    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(server()).delete(`${base}/${id}`).expect(404);
    expect((await request(server()).get(base).expect(200)).body.data).toHaveLength(0);
    await on().expect(201); // their own switch for the same week is independent
  });
});
