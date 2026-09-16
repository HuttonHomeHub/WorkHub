import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Regression tests for request bodies the parser rejects before any route runs.
 * `express.json()` refuses a body over its 100 kB limit with a
 * `PayloadTooLargeError`, which the exception filter used to turn into a 500
 * `INTERNAL_ERROR`. It must be a 413 in the standard error envelope, while
 * malformed JSON stays a 400 (docs/API.md → Status codes, Payload limits).
 *
 * Requires a database (the app connects on boot); skipped locally when
 * DATABASE_URL is unset.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('Request body parsing (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.LOG_LEVEL ??= 'silent';
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

  const oversized = 'x'.repeat(200 * 1024);

  it('answers a JSON body over the size limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/me')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: oversized }))
      .expect(413);

    expect(res.body).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: expect.any(String) },
    });
    expect(res.headers['x-correlation-id']).toEqual(expect.any(String));
  });

  it('answers a URL-encoded body over the size limit with 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/me')
      .type('form')
      .send(`name=${oversized}`)
      .expect(413);

    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('answers an unsupported JSON charset with 415 and a fixed message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/me')
      .set('Content-Type', 'application/json; charset=latin-2')
      .send('{"name":"x"}')
      .expect(415);

    // The parser's own message would echo the charset back.
    expect(res.body).toEqual({
      error: {
        code: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'The request body charset is not supported.',
      },
    });
    expect(res.headers['x-correlation-id']).toEqual(expect.any(String));
  });

  it('answers a URL-encoded body nested beyond the parser depth with 400', async () => {
    const key = `a${'[b]'.repeat(40)}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/me')
      .type('form')
      .send(`${key}=1`)
      .expect(400);

    expect(res.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'The request body is nested too deeply.' },
    });
  });

  it('keeps answering malformed JSON with 400 BAD_REQUEST', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/me')
      .set('Content-Type', 'application/json')
      .send('{"name":')
      .expect(400);

    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
