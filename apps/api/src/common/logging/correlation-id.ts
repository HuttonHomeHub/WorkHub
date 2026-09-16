import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Picks a request's correlation id — the inbound `x-correlation-id` header, or a
 * new UUID — and returns it in the response header (docs/OBSERVABILITY.md).
 *
 * The request logger's `genReqId` calls it for every request it sees. The
 * exception filter calls it for a request that failed before the logger ran,
 * such as a body the parser rejected, so that error still has an id to log
 * and return.
 */
export function assignCorrelationId(req: IncomingMessage, res: ServerResponse): string {
  const header = req.headers[CORRELATION_ID_HEADER];
  const id = (typeof header === 'string' && header) || randomUUID();
  res.setHeader(CORRELATION_ID_HEADER, id);
  return id;
}
