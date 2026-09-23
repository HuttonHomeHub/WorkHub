import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the reference items API. Boots the real Nest app
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

const USER = '018f4e8a-9a1b-7c2d-8e3f-4a5b6c7d8e9f';
const OTHER_USER = '018f4e8a-7b2c-7c3d-8e4f-1a2b3c4d5e6f';

describe.skipIf(!hasDatabase)('Reference items API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/reference-items';

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
    await prisma.referenceItem.deleteMany();
  });

  const create = (name = 'First item') => request(app.getHttpServer()).post(base).send({ name });

  it('creates an item (201) owned by the caller, in the standard envelope', async () => {
    const res = await create('My item').expect(201);
    expect(res.body.data).toMatchObject({
      name: 'My item',
      ownerId: USER,
      version: 1,
    });
    expect(res.body.data.id).toEqual(expect.any(String));
    // Correlation id is returned for traceability.
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('rejects an invalid payload with 422', async () => {
    const res = await request(app.getHttpServer()).post(base).send({ name: '' }).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('lists only the caller’s items with pagination metadata', async () => {
    await create('A').expect(201);
    await create('B').expect(201);
    const res = await request(app.getHttpServer()).get(base).query({ limit: 1 }).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ hasMore: true });
    expect(res.body.meta.nextCursor).toEqual(expect.any(String));

    const next = await request(app.getHttpServer())
      .get(base)
      .query({ limit: 1, cursor: res.body.meta.nextCursor as string })
      .expect(200);
    expect(next.body.data).toHaveLength(1);
    expect(next.body.data[0].id).not.toBe(res.body.data[0].id);
  });

  it('rejects a malformed cursor with 400 (not a 500 from the database)', async () => {
    const res = await request(app.getHttpServer())
      .get(base)
      .query({ cursor: 'not-a-cursor' })
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('fetches an item by id (200) and 404s for a missing one', async () => {
    const created = await create('Fetch me').expect(201);
    const id = created.body.data.id as string;
    await request(app.getHttpServer()).get(`${base}/${id}`).expect(200);
    await request(app.getHttpServer())
      .get(`${base}/018f0000-0000-7000-8000-000000000000`)
      .expect(404);
  });

  it("hides another user's item behind the same 404 (IDOR defence)", async () => {
    const created = await create('Mine').expect(201);
    const id = created.body.data.id as string;

    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(app.getHttpServer()).get(`${base}/${id}`).expect(404);
    const list = await request(app.getHttpServer()).get(base).expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('enforces optimistic locking on update (409 on stale version)', async () => {
    const created = await create('Editable').expect(201);
    const id = created.body.data.id as string;

    const updated = await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .send({ name: 'Renamed', version: 1 })
      .expect(200);
    expect(updated.body.data).toMatchObject({ name: 'Renamed', version: 2 });

    await request(app.getHttpServer())
      .patch(`${base}/${id}`)
      .send({ name: 'Stale', version: 1 })
      .expect(409);
  });

  it('soft-deletes (204) and then 404s and hides from lists', async () => {
    const created = await create('Delete me').expect(201);
    const id = created.body.data.id as string;

    await request(app.getHttpServer()).delete(`${base}/${id}`).expect(204);
    await request(app.getHttpServer()).get(`${base}/${id}`).expect(404);

    const list = await request(app.getHttpServer()).get(base).expect(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('restores a soft-deleted item (200) with a new version, and restore is idempotent', async () => {
    const created = await create('Undo me').expect(201);
    const id = created.body.data.id as string;
    await request(app.getHttpServer()).delete(`${base}/${id}`).expect(204);

    const restored = await request(app.getHttpServer()).post(`${base}/${id}/restore`).expect(200);
    expect(restored.body.data).toMatchObject({ id, name: 'Undo me', version: 2 });
    await request(app.getHttpServer()).get(`${base}/${id}`).expect(200);

    const again = await request(app.getHttpServer()).post(`${base}/${id}/restore`).expect(200);
    expect(again.body.data.version).toBe(2);
  });

  it("404s when restoring a missing item or another user's deleted item", async () => {
    await request(app.getHttpServer())
      .post(`${base}/018f0000-0000-7000-8000-000000000000/restore`)
      .expect(404);

    const created = await create('Not yours').expect(201);
    const id = created.body.data.id as string;
    await request(app.getHttpServer()).delete(`${base}/${id}`).expect(204);

    principal = new Principal(OTHER_USER, 'other@example.com', 'Other User');
    await request(app.getHttpServer()).post(`${base}/${id}/restore`).expect(404);
  });

  it('rejects a malformed id on restore with 400', async () => {
    await request(app.getHttpServer()).post(`${base}/not-a-uuid/restore`).expect(400);
  });
});
