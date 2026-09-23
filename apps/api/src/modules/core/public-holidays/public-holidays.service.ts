import { Injectable } from '@nestjs/common';
import { Prisma, type PublicHoliday } from '@prisma/client';
import type { PageMeta } from '@repo/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { Principal } from '../../../common/auth/principal';
import { fromDbDate, toDbDate } from '../../../common/dates';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';

import type { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import type { ListPublicHolidaysQueryDto } from './dto/list-public-holidays-query.dto';
import type { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { englandAndWalesHolidays } from './england-and-wales';
import { PublicHolidaysRepository } from './public-holidays.repository';

/**
 * Public holidays service (core, ADR-0020 §2) — the **business-logic layer**. It orchestrates the
 * use case: authorise, apply rules, delegate persistence to the repository, and
 * log. It contains NO HTTP concerns (that's the controller) and NO raw Prisma
 * queries (that's the repository). Demonstrates owner-scoped authorisation
 * (anti-IDOR, ADR-0016), optimistic locking, soft delete with restore (undo),
 * and cursor pagination. See docs/REFERENCE_FEATURE.md.
 */
@Injectable()
export class PublicHolidaysService {
  constructor(
    private readonly repository: PublicHolidaysRepository,
    @InjectPinoLogger(PublicHolidaysService.name) private readonly logger: PinoLogger,
  ) {}

  async create(principal: Principal, dto: CreatePublicHolidayDto): Promise<PublicHoliday> {
    // "Unchecked" input takes the owner_id column directly (the checked variant
    // would require `owner: { connect }` because of the User relation).
    const data: Prisma.PublicHolidayUncheckedCreateInput = {
      // The owner is ALWAYS the authenticated principal — never client input.
      ownerId: principal.userId,
      date: toDbDate(dto.date),
      name: dto.name,
    };
    // A second active holiday on a date is a 409 from the partial unique index (P2002).

    const created = await this.repository.create(data);
    this.logger.info(
      { publicHolidayId: created.id, userId: principal.userId },
      'public holiday created',
    );
    return created;
  }

  async list(
    principal: Principal,
    query: ListPublicHolidaysQueryDto,
  ): Promise<{ items: PublicHoliday[]; meta: PageMeta }> {
    // Every list is scoped to the caller's own rows — the WHERE clause is the
    // authorisation (ADR-0016).
    const where: Prisma.PublicHolidayWhereInput = {
      ownerId: principal.userId,
      ...(query.from || query.to
        ? {
            date: {
              ...(query.from ? { gte: toDbDate(query.from) } : {}),
              ...(query.to ? { lt: toDbDate(query.to) } : {}),
            },
          }
        : {}),
    };

    // Cursor pagination: over-fetch by one to detect a further page. The
    // repository applies the soft-delete filter.
    const rows = await this.repository.findManyActive({
      where,
      orderBy: [{ [query.sort]: query.order }, { id: query.order }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    const hasMore = rows.length > query.limit;
    const items = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
    return { items, meta: { nextCursor, hasMore } };
  }

  /**
   * Add the bundled England and Wales bank holidays for a year that the owner
   * does not already have (an active holiday on the date), in one statement.
   * Returns the rows added; none when the year is already complete.
   */
  async importYear(principal: Principal, year: number): Promise<PublicHoliday[]> {
    const existing = await this.repository.findManyActive({
      where: {
        ownerId: principal.userId,
        date: { gte: toDbDate(`${year}-01-01`), lt: toDbDate(`${year + 1}-01-01`) },
      },
      orderBy: [{ date: 'asc' }],
      take: 366,
    });
    const have = new Set(existing.map((row) => fromDbDate(row.date)));
    const missing = englandAndWalesHolidays(year).filter((holiday) => !have.has(holiday.date));
    if (missing.length === 0) return [];

    const added = await this.repository.createManyMissing(
      missing.map((holiday) => ({
        ownerId: principal.userId,
        date: toDbDate(holiday.date),
        name: holiday.name,
      })),
    );
    this.logger.info(
      { year, added: added.length, userId: principal.userId },
      'public holidays imported',
    );
    return added.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Whether the caller has an active public holiday on a date. Exported for
   * tools (ADR-0020 §3); scoped to the caller like every read.
   */
  async isHoliday(principal: Principal, date: string): Promise<boolean> {
    const rows = await this.repository.findManyActive({
      where: { ownerId: principal.userId, date: toDbDate(date) },
      orderBy: [{ date: 'asc' }],
      take: 1,
    });
    return rows.length > 0;
  }

  /** The caller's holidays in `[from, to)` (exported for tools, ADR-0020 §3). */
  async listForCalculation(
    principal: Principal,
    from: string,
    to: string,
  ): Promise<PublicHoliday[]> {
    return this.repository.findAllActive({
      where: {
        ownerId: principal.userId,
        date: { gte: toDbDate(from), lt: toDbDate(to) },
      },
      orderBy: [{ date: 'asc' }],
    });
  }

  async getById(principal: Principal, id: string): Promise<PublicHoliday> {
    return this.findOwnedOrThrow(principal, id);
  }

  async update(
    principal: Principal,
    id: string,
    dto: UpdatePublicHolidayDto,
  ): Promise<PublicHoliday> {
    await this.findOwnedOrThrow(principal, id);

    const data: Prisma.PublicHolidayUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    if (dto.date !== undefined) data.date = toDbDate(dto.date);
    if (dto.name !== undefined) data.name = dto.name;

    const changed = await this.repository.updateIfVersionMatches(id, dto.version, data);
    if (changed === 0) {
      this.logger.warn(
        { publicHolidayId: id, expectedVersion: dto.version, userId: principal.userId },
        'optimistic-lock conflict on update',
      );
      throw new ConflictError('This item was modified elsewhere. Refetch it and try again.');
    }

    this.logger.info({ publicHolidayId: id, userId: principal.userId }, 'public holiday updated');
    return this.findOwnedOrThrow(principal, id);
  }

  async remove(principal: Principal, id: string): Promise<void> {
    await this.findOwnedOrThrow(principal, id);

    await this.repository.softDelete(id);
    this.logger.info(
      { publicHolidayId: id, userId: principal.userId },
      'public holiday soft-deleted',
    );
  }

  /**
   * Undo a soft delete. Idempotent: restoring a row that is already active —
   * or that a concurrent request restored first — returns it, so a repeated
   * undo is harmless. A missing row, or one owned by someone else, is the same
   * 404 as everywhere else, after the same single read. If an active row now
   * holds the deleted row's unique key, the feature's partial unique index
   * answers 409 (`P2002`).
   */
  async restore(principal: Principal, id: string): Promise<PublicHoliday> {
    const item = await this.repository.findById(id);
    this.assertOwned(principal, item, id);
    if (item.deletedAt === null) return item;

    if ((await this.repository.restore(id)) > 0) {
      this.logger.info(
        { publicHolidayId: id, userId: principal.userId },
        'public holiday restored',
      );
    }
    // Restored now or by a concurrent request; a 404 only if it was purged.
    return this.findOwnedOrThrow(principal, id);
  }

  /** Load an active row and verify ownership (see {@link assertOwned}). */
  private async findOwnedOrThrow(principal: Principal, id: string): Promise<PublicHoliday> {
    const item = await this.repository.findActiveById(id);
    this.assertOwned(principal, item, id);
    return item;
  }

  /**
   * Verify ownership of a loaded row — the authoritative authorisation check
   * (anti-IDOR). A row owned by someone else yields the SAME 404 as a missing
   * row, so an attacker cannot probe which ids exist (ADR-0016).
   */
  private assertOwned(
    principal: Principal,
    item: PublicHoliday | null,
    id: string,
  ): asserts item is PublicHoliday {
    if (!item) {
      throw new NotFoundError('Public holiday not found.');
    }
    if (!principal.owns(item)) {
      this.logger.warn(
        { publicHolidayId: id, userId: principal.userId },
        'authorisation denied: not the owner',
      );
      throw new NotFoundError('Public holiday not found.');
    }
  }
}
