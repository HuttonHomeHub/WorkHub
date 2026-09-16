import { HttpException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { PaginationQueryDto } from './pagination-query.dto';

/**
 * Regression tests: the list `cursor` was accepted by `@IsString()` alone, so a
 * malformed value reached Prisma, which threw `P2023`, and the API answered
 * 500. A cursor that cannot be a row id is a request that cannot be
 * interpreted — 400, not 422 (docs/API.md → Status codes, Lists).
 */
// Configured as the global pipe in AppModule.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  errorHttpStatusCode: 422,
});

async function statusFor(query: Record<string, unknown>): Promise<number | 'ok'> {
  try {
    await pipe.transform(query, { type: 'query', metatype: PaginationQueryDto });
    return 'ok';
  } catch (error) {
    if (error instanceof HttpException) return error.getStatus();
    throw error;
  }
}

describe('PaginationQueryDto', () => {
  it('accepts a cursor that is a row id (UUID) and keeps it', async () => {
    const cursor = '018f4e8a-9a1b-7c2d-8e3f-4a5b6c7d8e9f';
    await expect(statusFor({ cursor })).resolves.toBe('ok');
    const dto = (await pipe.transform(
      { cursor },
      { type: 'query', metatype: PaginationQueryDto },
    )) as PaginationQueryDto;
    expect(dto.cursor).toBe(cursor);
  });

  it('rejects a non-string cursor with 400', async () => {
    await expect(statusFor({ cursor: 42 })).resolves.toBe(400);
    await expect(statusFor({ cursor: null })).resolves.toBe(400);
  });

  it('accepts a request without a cursor', async () => {
    await expect(statusFor({ limit: '10' })).resolves.toBe('ok');
  });

  it.each(['not-a-cursor', '1234', "' OR 1=1 --", ''])(
    'rejects the malformed cursor %j with 400',
    async (cursor) => {
      await expect(statusFor({ cursor })).resolves.toBe(400);
    },
  );

  it('rejects a repeated cursor parameter with 400', async () => {
    await expect(
      statusFor({ cursor: ['018f4e8a-9a1b-7c2d-8e3f-4a5b6c7d8e9f', 'x'] }),
    ).resolves.toBe(400);
  });

  it('keeps answering a rule violation such as limit=0 with 422', async () => {
    await expect(statusFor({ limit: '0' })).resolves.toBe(422);
  });
});
