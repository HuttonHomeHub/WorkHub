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

/** The shape body-parser (via http-errors) rejects a body with. */
function bodyParserError(status: number, type: string, message: string): Error {
  return Object.assign(new Error(message), { status, statusCode: status, expose: true, type });
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

  it('maps an oversized body (PayloadTooLargeError) to 413 PAYLOAD_TOO_LARGE', () => {
    const reply = run(bodyParserError(413, 'entity.too.large', 'request entity too large'));

    expect(reply.status).toBe(413);
    expect(reply.body).toEqual({
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
    });
  });

  it('maps an unsupported body charset to 415 UNSUPPORTED_MEDIA_TYPE', () => {
    const reply = run(bodyParserError(415, 'charset.unsupported', 'unsupported charset "LATIN-2"'));

    expect(reply.status).toBe(415);
    expect(reply.body).toEqual({
      error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'unsupported charset "LATIN-2"' },
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

  describe('correlation id', () => {
    it('logs the request id the request logger assigned', () => {
      const filter = new AllExceptionsFilter();
      const warn = vi.spyOn(filter['logger'], 'warn').mockImplementation(() => undefined);
      const response = { status: () => response, json: () => response, setHeader: vi.fn() };
      const host = {
        switchToHttp: () => ({
          getResponse: () => response,
          getRequest: () => ({ id: 'from-pino', method: 'GET', url: '/x', headers: {} }),
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new BadRequestException(), host);

      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ correlationId: 'from-pino' }),
        expect.any(String),
      );
      expect(response.setHeader).not.toHaveBeenCalled();
    });

    it('assigns one when the request failed before the request logger ran (body parsing)', () => {
      const reply = run(bodyParserError(413, 'entity.too.large', 'request entity too large'), {
        headers: { 'x-correlation-id': 'client-supplied' },
      });

      expect(reply.headers['x-correlation-id']).toBe('client-supplied');
    });
  });
});
