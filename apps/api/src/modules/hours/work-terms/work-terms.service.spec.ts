import type { WorkTerm } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Principal } from '../../../common/auth/principal';
import { toDbDate, toDbTime } from '../../../common/dates';
import { NotFoundError, ValidationError } from '../../../common/errors/domain-errors';

import type { PrismaService } from '../../../prisma/prisma.service';

import type { WorkTermsRepository } from './work-terms.repository';
import { WorkTermsService } from './work-terms.service';

const USER = '33333333-3333-7333-8333-333333333333';
const OTHER_USER = '55555555-5555-7555-8555-555555555555';
const ID = '44444444-4444-7444-8444-444444444444';

function makeTerms(overrides: Partial<WorkTerm> = {}): WorkTerm {
  return {
    id: ID,
    ownerId: USER,
    effectiveFrom: toDbDate('2026-10-05'),
    targetMinutesMon: 450,
    targetMinutesTue: 450,
    targetMinutesWed: 450,
    targetMinutesThu: 450,
    targetMinutesFri: 450,
    targetMinutesSat: null,
    targetMinutesSun: null,
    minMinutesMon: 450,
    minMinutesTue: 450,
    minMinutesWed: 450,
    minMinutesThu: 450,
    minMinutesFri: 330,
    minMinutesSat: null,
    minMinutesSun: null,
    breakThresholdMinutes: 360,
    breakMinimumMinutes: 30,
    bandStart: toDbTime('07:00'),
    bandEnd: toDbTime('19:00'),
    paidOvertimeAllowed: false,
    toilMonthlyCapMinutes: 450,
    leaveDayMaxMinutes: 450,
    flexiCreditCapMinutes: null,
    flexiDebitCapMinutes: null,
    version: 1,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

const week = (value: number | null, weekend: number | null = null) => ({
  mon: value,
  tue: value,
  wed: value,
  thu: value,
  fri: value,
  sat: weekend,
  sun: weekend,
});

/**
 * Unit tests for the rules the service adds to the template: defaults,
 * minimums kept consistent with targets, the band order, and the last terms.
 * Endpoint behaviour is proven by test/work-terms.e2e-spec.ts.
 */
describe('WorkTermsService', () => {
  const repository = {
    create: vi.fn(),
    findActiveById: vi.fn(),
    findById: vi.fn(),
    findManyActive: vi.fn(),
    updateIfVersionMatches: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    lockActiveIdsForOwner: vi.fn(),
  };
  const tx = { tx: true };
  const prisma = { $transaction: vi.fn((fn: (client: unknown) => unknown) => fn(tx)) };
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  let service: WorkTermsService;
  const owner = new Principal(USER, 'owner@example.com', 'Owner');
  const other = new Principal(OTHER_USER, 'other@example.com', 'Other');

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkTermsService(
      repository as unknown as WorkTermsRepository,
      prisma as unknown as PrismaService,
      logger as never,
    );
    repository.create.mockImplementation((data: object) => Promise.resolve(makeTerms(data)));
  });

  describe('create', () => {
    it("applies the owner's defaults, owned by the caller", async () => {
      await service.create(owner, { effectiveFrom: '2026-10-05' });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: USER,
          effectiveFrom: toDbDate('2026-10-05'),
          targetMinutesFri: 450,
          minMinutesFri: 330,
          targetMinutesSat: null,
          bandStart: toDbTime('07:00'),
          paidOvertimeAllowed: false,
        }),
      );
    });

    it('clears and lowers default minimums to fit targets sent alone', async () => {
      await service.create(owner, {
        effectiveFrom: '2026-10-05',
        targetMinutes: { ...week(420), fri: null },
      });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          minMinutesMon: 420,
          minMinutesFri: null,
          targetMinutesFri: null,
        }),
      );
    });

    it('rejects a minimum on a non-working day, a minimum over its target, and a reversed band', async () => {
      const attempt = service.create(owner, {
        effectiveFrom: '2026-10-05',
        targetMinutes: week(450),
        minimumMinutes: { ...week(460), sat: 60 },
        bandStart: '19:00',
        bandEnd: '07:00',
      });
      await expect(attempt).rejects.toBeInstanceOf(ValidationError);
      await expect(attempt).rejects.toMatchObject({
        details: expect.arrayContaining([
          'minimumMinutes.sat must be null on a non-working day',
          'minimumMinutes.mon must not exceed targetMinutes.mon',
          'bandEnd must be after bandStart',
        ]),
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('merges the body over the stored row and keeps minimums consistent', async () => {
      repository.findActiveById.mockResolvedValue(makeTerms());
      repository.updateIfVersionMatches.mockResolvedValue(1);

      await service.update(owner, ID, { version: 1, targetMinutes: { ...week(450), fri: 300 } });

      expect(repository.updateIfVersionMatches).toHaveBeenCalledWith(
        ID,
        1,
        expect.objectContaining({
          targetMinutesFri: 300,
          minMinutesFri: 300,
          minMinutesMon: 450,
          version: { increment: 1 },
        }),
      );
    });

    it('rejects a band end moved before the stored start', async () => {
      repository.findActiveById.mockResolvedValue(makeTerms());
      await expect(
        service.update(owner, ID, { version: 1, bandEnd: '06:00' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('remove', () => {
    it('refuses to delete the last remaining terms', async () => {
      repository.findActiveById.mockResolvedValue(makeTerms());
      repository.lockActiveIdsForOwner.mockResolvedValue([ID]);
      await expect(service.remove(owner, ID)).rejects.toBeInstanceOf(ValidationError);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('deletes when other terms remain', async () => {
      repository.findActiveById.mockResolvedValue(makeTerms());
      repository.lockActiveIdsForOwner.mockResolvedValue([ID, 'other-terms']);
      await service.remove(owner, ID);
      expect(repository.lockActiveIdsForOwner).toHaveBeenCalledWith(USER, tx);
      expect(repository.softDelete).toHaveBeenCalledWith(ID, tx);
    });

    it("hides another owner's terms behind the same 404", async () => {
      repository.findActiveById.mockResolvedValue(makeTerms());
      await expect(service.remove(other, ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.lockActiveIdsForOwner).not.toHaveBeenCalled();
    });
  });
});
