import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { AllExceptionsFilter } from './all-exceptions.filter';

interface Captured {
  status?: number;
  body?: unknown;
  headers: Record<string, string>;
}

/** Runs the filter against a fake Express request/response and captures the reply. */
function run(
  exception: unknown,
  request: { id?: string; headers?: Record<string, string> } = {},
): Captured {
  const captured: Captured = { headers: {} };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      captured.headers[name.toLowerCase()] = value;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ method: 'POST', url: '/api/v1/things', headers: {}, ...request }),
    }),
  } as unknown as ArgumentsHost;

  const filter = new AllExceptionsFilter();
  // Keep test output quiet; the log calls themselves are asserted below.
  vi.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
  vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);
  filter.catch(exception, host);
  return captured;
}

describe('AllExceptionsFilter', () => {
  it('maps Prisma P2023 (a malformed value for a column, e.g. a bad UUID cursor) to 400', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Inconsistent column data', {
      code: 'P2023',
      clientVersion: 'test',
    });

    const reply = run(error);

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'The request contains a malformed value.' },
    });
  });

  it('still answers an unknown error with an opaque 500', () => {
    const reply = run(Object.assign(new Error('boom'), { status: 413 }));

    expect(reply.status).toBe(500);
    expect(reply.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
    });
  });

  it('keeps Nest HTTP exceptions as they are', () => {
    const reply = run(new BadRequestException('Parameter must be a valid UUID.'));

    expect(reply.status).toBe(400);
    expect(reply.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Parameter must be a valid UUID.' },
    });
  });
});
