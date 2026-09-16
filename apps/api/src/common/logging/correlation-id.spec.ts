import type { IncomingMessage, ServerResponse } from 'node:http';

import { describe, expect, it } from 'vitest';

import { assignCorrelationId } from './correlation-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Runs the helper with an optional inbound header; returns the id and the response header. */
function assign(header?: string | string[]): { id: string; responseHeader: string | undefined } {
  const headers: Record<string, string> = {};
  const req = {
    headers: header === undefined ? {} : { 'x-correlation-id': header },
  } as unknown as IncomingMessage;
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  } as unknown as ServerResponse;
  const id = assignCorrelationId(req, res);
  return { id, responseHeader: headers['x-correlation-id'] };
}

describe('assignCorrelationId', () => {
  it('reuses a well-formed client id and echoes it', () => {
    expect(assign('trace-413.abc_DEF')).toEqual({
      id: 'trace-413.abc_DEF',
      responseHeader: 'trace-413.abc_DEF',
    });
  });

  it('generates a UUID when the header is missing', () => {
    const { id, responseHeader } = assign();
    expect(id).toMatch(UUID);
    expect(responseHeader).toBe(id);
  });

  it('replaces an id longer than 64 characters', () => {
    expect(assign('a'.repeat(64)).id).toBe('a'.repeat(64));
    const { id, responseHeader } = assign('a'.repeat(65));
    expect(id).toMatch(UUID);
    expect(responseHeader).toBe(id);
  });

  it.each(['has space', 'line\nbreak', '{"json":true}', 'naïve', ''])(
    'replaces the id %j, which has characters outside [A-Za-z0-9._-]',
    (header) => {
      expect(assign(header).id).toMatch(UUID);
    },
  );

  it('replaces a repeated header', () => {
    expect(assign(['one', 'two']).id).toMatch(UUID);
  });
});
