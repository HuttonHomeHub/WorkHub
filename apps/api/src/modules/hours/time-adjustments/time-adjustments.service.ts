import { Injectable } from '@nestjs/common';
import { Prisma, type TimeAdjustment } from '@prisma/client';
import type { PageMeta } from '@repo/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { Principal } from '../../../common/auth/principal';
import { toDbDate } from '../../../common/dates';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';

import type { CreateTimeAdjustmentDto } from './dto/create-time-adjustment.dto';
import type { ListTimeAdjustmentsQueryDto } from './dto/list-time-adjustments-query.dto';
import type { UpdateTimeAdjustmentDto } from './dto/update-time-adjustment.dto';
import { TimeAdjustmentsRepository } from './time-adjustments.repository';

/**
 * Time adjustments service — the **business-logic layer**. It orchestrates the
 * use case: authorise, apply rules, delegate persistence to the repository, and
 * log. It contains NO HTTP concerns (that's the controller) and NO raw Prisma
 * queries (that's the repository). Demonstrates owner-scoped authorisation
 * (anti-IDOR, ADR-0016), optimistic locking, soft delete with restore (undo),
 * and cursor pagination. See docs/REFERENCE_FEATURE.md.
 */
@Injectable()
export class TimeAdjustmentsService {
  constructor(
    private readonly repository: TimeAdjustmentsRepository,
    @InjectPinoLogger(TimeAdjustmentsService.name) private readonly logger: PinoLogger,
  ) {}

  async create(principal: Principal, dto: CreateTimeAdjustmentDto): Promise<TimeAdjustment> {
    // "Unchecked" input takes the owner_id column directly (the checked variant
    // would require `owner: { connect }` because of the User relation).
    const data: Prisma.TimeAdjustmentUncheckedCreateInput = {
      // The owner is ALWAYS the authenticated principal — never client input.
      ownerId: principal.userId,
      effectiveDate: toDbDate(dto.effectiveDate),
      balance: dto.balance,
      minutes: dto.minutes,
      reason: dto.reason,
    };

    const created = await this.repository.create(data);
    this.logger.info(
      { timeAdjustmentId: created.id, userId: principal.userId },
      'time adjustment created',
    );
    return created;
  }

  async list(
    principal: Principal,
    query: ListTimeAdjustmentsQueryDto,
  ): Promise<{ items: TimeAdjustment[]; meta: PageMeta }> {
    // Every list is scoped to the caller's own rows — the WHERE clause is the
    // authorisation (ADR-0016).
    const where: Prisma.TimeAdjustmentWhereInput = {
      ownerId: principal.userId,
      ...(query.balance ? { balance: query.balance } : {}),
      ...(query.from || query.to
        ? {
            effectiveDate: {
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

  /** The caller's adjustments in `[from, to)`, for the hours calculation. */
  async listForCalculation(
    principal: Principal,
    from: string,
    to: string,
  ): Promise<TimeAdjustment[]> {
    return this.repository.findAllActive({
      where: {
        ownerId: principal.userId,
        effectiveDate: { gte: toDbDate(from), lt: toDbDate(to) },
      },
      orderBy: [{ effectiveDate: 'asc' }],
    });
  }

  async getById(principal: Principal, id: string): Promise<TimeAdjustment> {
    return this.findOwnedOrThrow(principal, id);
  }

  async update(
    principal: Principal,
    id: string,
    dto: UpdateTimeAdjustmentDto,
  ): Promise<TimeAdjustment> {
    await this.findOwnedOrThrow(principal, id);

    const data: Prisma.TimeAdjustmentUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    if (dto.effectiveDate !== undefined) data.effectiveDate = toDbDate(dto.effectiveDate);
    if (dto.balance !== undefined) data.balance = dto.balance;
    if (dto.minutes !== undefined) data.minutes = dto.minutes;
    if (dto.reason !== undefined) data.reason = dto.reason;

    const changed = await this.repository.updateIfVersionMatches(id, dto.version, data);
    if (changed === 0) {
      this.logger.warn(
        { timeAdjustmentId: id, expectedVersion: dto.version, userId: principal.userId },
        'optimistic-lock conflict on update',
      );
      throw new ConflictError('This item was modified elsewhere. Refetch it and try again.');
    }

    this.logger.info({ timeAdjustmentId: id, userId: principal.userId }, 'time adjustment updated');
    return this.findOwnedOrThrow(principal, id);
  }

  async remove(principal: Principal, id: string): Promise<void> {
    await this.findOwnedOrThrow(principal, id);

    await this.repository.softDelete(id);
    this.logger.info(
      { timeAdjustmentId: id, userId: principal.userId },
      'time adjustment soft-deleted',
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
  async restore(principal: Principal, id: string): Promise<TimeAdjustment> {
    const item = await this.repository.findById(id);
    this.assertOwned(principal, item, id);
    if (item.deletedAt === null) return item;

    if ((await this.repository.restore(id)) > 0) {
      this.logger.info(
        { timeAdjustmentId: id, userId: principal.userId },
        'time adjustment restored',
      );
    }
    // Restored now or by a concurrent request; a 404 only if it was purged.
    return this.findOwnedOrThrow(principal, id);
  }

  /** Load an active row and verify ownership (see {@link assertOwned}). */
  private async findOwnedOrThrow(principal: Principal, id: string): Promise<TimeAdjustment> {
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
    item: TimeAdjustment | null,
    id: string,
  ): asserts item is TimeAdjustment {
    if (!item) {
      throw new NotFoundError('Time adjustment not found.');
    }
    if (!principal.owns(item)) {
      this.logger.warn(
        { timeAdjustmentId: id, userId: principal.userId },
        'authorisation denied: not the owner',
      );
      throw new NotFoundError('Time adjustment not found.');
    }
  }
}
