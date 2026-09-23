import type { PublicHoliday } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Principal } from '../../../common/auth/principal';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';

import type { PublicHolidaysRepository } from './public-holidays.repository';
import { PublicHolidaysService } from './public-holidays.service';

const USER = '33333333-3333-7333-8333-333333333333';
const OTHER_USER = '55555555-5555-7555-8555-555555555555';
const ITEM_ID = '44444444-4444-7444-8444-444444444444';

function makeItem(overrides: Partial<PublicHoliday> = {}): PublicHoliday {
  return {
    id: ITEM_ID,
    ownerId: USER,
    date: new Date('2026-12-25T00:00:00.000Z'),
    name: 'Example',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Unit tests for the service's own rules — ownership 404s, optimistic-lock
 * conflicts and cursor maths — with the repository stubbed. Endpoint behaviour
 * is proven by the API e2e test against Postgres, the primary layer
 * (docs/TESTING.md); delete cases a generated feature has no logic for.
 */
describe('PublicHolidaysService', () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findActiveById: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findManyActive: ReturnType<typeof vi.fn>;
    updateIfVersionMatches: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    createManyMissing: ReturnType<typeof vi.fn>;
  };
  let service: PublicHolidaysService;
  let owner: Principal;
  let otherUser: Principal;

  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = {
      create: vi.fn(),
      findActiveById: vi.fn(),
      findById: vi.fn(),
      findManyActive: vi.fn(),
      updateIfVersionMatches: vi.fn(),
      softDelete: vi.fn(),
      restore: vi.fn(),
      createManyMissing: vi.fn(),
    };
    service = new PublicHolidaysService(
      repository as unknown as PublicHolidaysRepository,
      logger as never,
    );
    owner = new Principal(USER, 'owner@example.com', 'Owner');
    otherUser = new Principal(OTHER_USER, 'other@example.com', 'Other');
  });

  describe('create', () => {
    it('creates an item owned by the caller', async () => {
      repository.create.mockResolvedValue(makeItem());

      const result = await service.create(owner, { date: '2026-12-25', name: 'Example' });

      expect(result.id).toBe(ITEM_ID);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: USER,
          date: new Date('2026-12-25T00:00:00.000Z'),
          name: 'Example',
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns an item the caller owns', async () => {
      repository.findActiveById.mockResolvedValue(makeItem());
      const result = await service.getById(owner, ITEM_ID);
      expect(result.id).toBe(ITEM_ID);
      expect(repository.findActiveById).toHaveBeenCalledWith(ITEM_ID);
    });

    it('throws NotFound when the item is absent or soft-deleted', async () => {
      repository.findActiveById.mockResolvedValue(null);
      await expect(service.getById(owner, ITEM_ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("hides another user's item behind the same 404 (IDOR defence)", async () => {
      repository.findActiveById.mockResolvedValue(makeItem({ ownerId: USER }));
      await expect(service.getById(otherUser, ITEM_ID)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('update (optimistic locking)', () => {
    it('updates when the version matches and increments it', async () => {
      repository.findActiveById
        .mockResolvedValueOnce(makeItem({ version: 1 }))
        .mockResolvedValueOnce(makeItem({ version: 2, name: 'New' }));
      repository.updateIfVersionMatches.mockResolvedValue(1);

      const result = await service.update(owner, ITEM_ID, { name: 'New', version: 1 });

      expect(result.version).toBe(2);
      expect(repository.updateIfVersionMatches).toHaveBeenCalledWith(
        ITEM_ID,
        1,
        expect.objectContaining({ name: 'New', version: { increment: 1 } }),
      );
    });

    it('throws Conflict when the version does not match', async () => {
      repository.findActiveById.mockResolvedValue(makeItem({ version: 5 }));
      repository.updateIfVersionMatches.mockResolvedValue(0);

      await expect(
        service.update(owner, ITEM_ID, { name: 'New', version: 1 }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("refuses to update another user's item", async () => {
      repository.findActiveById.mockResolvedValue(makeItem({ ownerId: USER }));
      await expect(
        service.update(otherUser, ITEM_ID, { name: 'New', version: 1 }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.updateIfVersionMatches).not.toHaveBeenCalled();
    });
  });

  describe('remove (soft delete)', () => {
    it('soft-deletes via the repository', async () => {
      repository.findActiveById.mockResolvedValue(makeItem());
      repository.softDelete.mockResolvedValue(undefined);

      await service.remove(owner, ITEM_ID);

      expect(repository.softDelete).toHaveBeenCalledWith(ITEM_ID);
    });

    it("refuses to delete another user's item", async () => {
      repository.findActiveById.mockResolvedValue(makeItem({ ownerId: USER }));
      await expect(service.remove(otherUser, ITEM_ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('restore (undo a soft delete)', () => {
    it('restores a deleted item the caller owns', async () => {
      repository.findById.mockResolvedValue(makeItem({ deletedAt: new Date() }));
      repository.restore.mockResolvedValue(1);
      repository.findActiveById.mockResolvedValue(makeItem({ version: 2 }));

      const result = await service.restore(owner, ITEM_ID);

      expect(repository.restore).toHaveBeenCalledWith(ITEM_ID);
      expect(result.version).toBe(2);
    });

    it('returns an item that is already active unchanged (idempotent)', async () => {
      repository.findById.mockResolvedValue(makeItem());

      const result = await service.restore(owner, ITEM_ID);

      expect(result.id).toBe(ITEM_ID);
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('throws NotFound when the item does not exist', async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.restore(owner, ITEM_ID)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("refuses to restore another user's item", async () => {
      repository.findById.mockResolvedValue(makeItem({ ownerId: USER, deletedAt: new Date() }));
      await expect(service.restore(otherUser, ITEM_ID)).rejects.toBeInstanceOf(NotFoundError);
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('returns the row when a concurrent request restored it first', async () => {
      repository.findById.mockResolvedValue(makeItem({ deletedAt: new Date() }));
      repository.restore.mockResolvedValue(0);
      repository.findActiveById.mockResolvedValue(makeItem({ version: 2 }));

      const result = await service.restore(owner, ITEM_ID);

      expect(result.version).toBe(2);
    });
  });

  describe('importYear', () => {
    it('adds only the bundled dates the owner does not have, in date order', async () => {
      repository.findManyActive.mockResolvedValue([
        makeItem({ date: new Date('2026-12-25T00:00:00.000Z') }),
      ]);
      // The database may return rows in any order; the service sorts them.
      repository.createManyMissing.mockResolvedValue(
        ['2026-12-28', '2026-01-01', '2026-08-31'].map((date) =>
          makeItem({ date: new Date(`${date}T00:00:00.000Z`) }),
        ),
      );

      const added = await service.importYear(owner, 2026);

      const created = repository.createManyMissing.mock.calls[0]![0] as {
        ownerId: string;
        date: Date;
      }[];
      expect(created).toHaveLength(7);
      expect(created.every((row) => row.ownerId === USER)).toBe(true);
      expect(created.map((row) => row.date.toISOString().slice(0, 10))).not.toContain('2026-12-25');
      expect(added.map((row) => row.date.toISOString().slice(0, 10))).toEqual([
        '2026-01-01',
        '2026-08-31',
        '2026-12-28',
      ]);
    });

    it('adds nothing when the year is complete', async () => {
      const all = [
        '2026-01-01',
        '2026-04-03',
        '2026-04-06',
        '2026-05-04',
        '2026-05-25',
        '2026-08-31',
        '2026-12-25',
        '2026-12-28',
      ].map((date) => makeItem({ date: new Date(`${date}T00:00:00.000Z`) }));
      repository.findManyActive.mockResolvedValue(all);

      expect(await service.importYear(owner, 2026)).toEqual([]);
      expect(repository.createManyMissing).not.toHaveBeenCalled();
    });
  });

  describe('list (pagination)', () => {
    it('scopes the query to the caller and returns a next cursor when more rows exist', async () => {
      const rows = [makeItem({ id: 'a' }), makeItem({ id: 'b' }), makeItem({ id: 'c' })];
      repository.findManyActive.mockResolvedValue(rows);

      const result = await service.list(owner, {
        limit: 2,
        order: 'desc',
        sort: 'createdAt',
      });

      expect(result.items).toHaveLength(2);
      expect(result.meta).toEqual({ nextCursor: 'b', hasMore: true });
      // Scoped to the caller's rows and over-fetching by one to detect a page.
      expect(repository.findManyActive).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: USER }),
          take: 3,
        }),
      );
    });

    it('has no next cursor on the last page', async () => {
      repository.findManyActive.mockResolvedValue([makeItem({ id: 'a' })]);

      const result = await service.list(owner, {
        limit: 2,
        order: 'desc',
        sort: 'createdAt',
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta).toEqual({ nextCursor: null, hasMore: false });
    });
  });
});
