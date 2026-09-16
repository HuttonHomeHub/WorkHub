import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';

import { UUID_REGEX } from './uuid';

/**
 * Validates a list `cursor` query parameter. Today a cursor is the last row's
 * id, so anything that is not a UUID cannot have come from `meta.nextCursor`.
 *
 * A malformed cursor is a request that cannot be interpreted, so it is a **400**
 * like a malformed path id — not the 422 the global `ValidationPipe` gives a
 * rule violation (docs/API.md → Status codes). The check therefore runs in the
 * transform step, which the pipe runs before validation, and throws the 400
 * itself. Without it the value reaches Prisma, which rejects it with `P2023`.
 * Clients still treat the cursor as opaque; change this check with the format.
 */
export function IsCursor(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) => {
    if (value === undefined) return value;
    if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
      throw new BadRequestException('cursor must be a value from a previous meta.nextCursor.');
    }
    return value;
  });
}
