import type { LeaveYear } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Principal } from '../../../common/auth/principal';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';

import type { LeaveYearsRepository } from './leave-years.repository';
import { LeaveYearsService } from './leave-years.service';

const USER = '33333333-3333-7333-8333-333333333333';
const OTHER_USER = '55555555-5555-7555-8555-555555555555';
const ID = '44444444-4444-7444-8444-444444444444';

function makeYear(overrides: Partial<LeaveYear> = {}): LeaveYear {
  return {
    id: ID,
    ownerId: USER,
    year: 2026,
    allowanceMinutes: 14850,
    boughtLeave: false,
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

/** Service rules only; endpoint behaviour is in test/leave-years.e2e-spec.ts. */
describe('LeaveYearsService', () => {
  const repository = {
    create: vi.fn(),
    findActiveById: vi.fn(),
    findManyActive: vi.fn(),
    updateIfVersionMatches: vi.fn(),
  };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  let service: LeaveYearsService;
  const owner = new Principal(USER, 'owner@example.com', 'Owner');
  const other = new Principal(OTHER_USER, 'other@example.com', 'Other');

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeaveYearsService(repository as unknown as LeaveYearsRepository, logger as never);
  });

  it('creates a year owned by the caller, leaving omitted fields to the defaults', async () => {
    repository.create.mockResolvedValue(makeYear());
    await service.create(owner, { year: 2026, boughtLeave: true });
    expect(repository.create).toHaveBeenCalledWith({
      ownerId: USER,
      year: 2026,
      boughtLeave: true,
    });
  });

  it('updates the allowance and bought leave with the version', async () => {
    repository.findActiveById.mockResolvedValue(makeYear());
    repository.updateIfVersionMatches.mockResolvedValue(1);
    await service.update(owner, ID, { version: 1, allowanceMinutes: 15000, boughtLeave: true });
    expect(repository.updateIfVersionMatches).toHaveBeenCalledWith(ID, 1, {
      version: { increment: 1 },
      allowanceMinutes: 15000,
      boughtLeave: true,
    });
  });

  it('throws Conflict on a stale version', async () => {
    repository.findActiveById.mockResolvedValue(makeYear({ version: 3 }));
    repository.updateIfVersionMatches.mockResolvedValue(0);
    await expect(service.update(owner, ID, { version: 1 })).rejects.toBeInstanceOf(ConflictError);
  });

  it("hides another owner's year behind the same 404", async () => {
    repository.findActiveById.mockResolvedValue(makeYear());
    await expect(service.getById(other, ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});
