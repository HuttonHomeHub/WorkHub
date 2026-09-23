import type { ExcessConversion } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Principal } from '../../../common/auth/principal';
import { toDbDate } from '../../../common/dates';
import { NotFoundError } from '../../../common/errors/domain-errors';

import type { ExcessConversionsRepository } from './excess-conversions.repository';
import { ExcessConversionsService } from './excess-conversions.service';

const USER = '33333333-3333-7333-8333-333333333333';
const OTHER_USER = '55555555-5555-7555-8555-555555555555';
const ID = '44444444-4444-7444-8444-444444444444';

const row = (overrides: Partial<ExcessConversion> = {}): ExcessConversion => ({
  id: ID,
  ownerId: USER,
  weekStart: toDbDate('2026-10-05'),
  version: 1,
  createdAt: new Date('2026-10-05T09:00:00Z'),
  updatedAt: new Date('2026-10-05T09:00:00Z'),
  deletedAt: null,
  ...overrides,
});

/** Service rules only; endpoint behaviour is in test/excess-conversions.e2e-spec.ts. */
describe('ExcessConversionsService', () => {
  const repository = {
    create: vi.fn(),
    findActiveById: vi.fn(),
    findManyActive: vi.fn(),
    softDelete: vi.fn(),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  let service: ExcessConversionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExcessConversionsService(
      repository as unknown as ExcessConversionsRepository,
      logger as never,
    );
  });

  it('switches a week on for the caller', async () => {
    repository.create.mockResolvedValue(row());
    await service.create(new Principal(USER, 'o@example.com', 'O'), { weekStart: '2026-10-05' });
    expect(repository.create).toHaveBeenCalledWith({
      ownerId: USER,
      weekStart: toDbDate('2026-10-05'),
    });
  });

  it('switches off by soft delete', async () => {
    repository.findActiveById.mockResolvedValue(row());
    await service.remove(new Principal(USER, 'o@example.com', 'O'), ID);
    expect(repository.softDelete).toHaveBeenCalledWith(ID);
  });

  it("hides another owner's switch behind the same 404", async () => {
    repository.findActiveById.mockResolvedValue(row());
    await expect(
      service.remove(new Principal(OTHER_USER, 'x@example.com', 'X'), ID),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.softDelete).not.toHaveBeenCalled();
  });
});
