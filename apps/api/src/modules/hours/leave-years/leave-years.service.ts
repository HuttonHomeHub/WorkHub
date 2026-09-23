import { Injectable } from '@nestjs/common';
import { Prisma, type LeaveYear } from '@prisma/client';
import type { PageMeta } from '@repo/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { Principal } from '../../../common/auth/principal';
import { ConflictError, NotFoundError } from '../../../common/errors/domain-errors';

import type { CreateLeaveYearDto } from './dto/create-leave-year.dto';
import type { ListLeaveYearsQueryDto } from './dto/list-leave-years-query.dto';
import type { UpdateLeaveYearDto } from './dto/update-leave-year.dto';
import { LeaveYearsRepository } from './leave-years.repository';

/**
 * Leave years service — the allowance and bought leave per calendar year for
 * the hours tool. Owner-scoped (anti-IDOR, ADR-0016) with optimistic locking.
 * A year's settings are edited, never deleted: a year without a row uses the
 * default allowance (docs/features/hours-tracker.md → Rule 12).
 */
@Injectable()
export class LeaveYearsService {
  constructor(
    private readonly repository: LeaveYearsRepository,
    @InjectPinoLogger(LeaveYearsService.name) private readonly logger: PinoLogger,
  ) {}

  async create(principal: Principal, dto: CreateLeaveYearDto): Promise<LeaveYear> {
    // "Unchecked" input takes the owner_id column directly (the checked variant
    // would require `owner: { connect }` because of the User relation).
    const data: Prisma.LeaveYearUncheckedCreateInput = {
      // The owner is ALWAYS the authenticated principal — never client input.
      ownerId: principal.userId,
      year: dto.year,
    };
    if (dto.allowanceMinutes !== undefined) data.allowanceMinutes = dto.allowanceMinutes;
    if (dto.boughtLeave !== undefined) data.boughtLeave = dto.boughtLeave;
    // A second row for the same year is a 409 from the partial unique index (P2002).

    const created = await this.repository.create(data);
    this.logger.info({ leaveYearId: created.id, userId: principal.userId }, 'leave year created');
    return created;
  }

  async list(
    principal: Principal,
    query: ListLeaveYearsQueryDto,
  ): Promise<{ items: LeaveYear[]; meta: PageMeta }> {
    // Every list is scoped to the caller's own rows — the WHERE clause is the
    // authorisation (ADR-0016).
    const where: Prisma.LeaveYearWhereInput = {
      ownerId: principal.userId,
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

  async getById(principal: Principal, id: string): Promise<LeaveYear> {
    return this.findOwnedOrThrow(principal, id);
  }

  async update(principal: Principal, id: string, dto: UpdateLeaveYearDto): Promise<LeaveYear> {
    await this.findOwnedOrThrow(principal, id);

    const data: Prisma.LeaveYearUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    if (dto.allowanceMinutes !== undefined) data.allowanceMinutes = dto.allowanceMinutes;
    if (dto.boughtLeave !== undefined) data.boughtLeave = dto.boughtLeave;

    const changed = await this.repository.updateIfVersionMatches(id, dto.version, data);
    if (changed === 0) {
      this.logger.warn(
        { leaveYearId: id, expectedVersion: dto.version, userId: principal.userId },
        'optimistic-lock conflict on update',
      );
      throw new ConflictError('This item was modified elsewhere. Refetch it and try again.');
    }

    this.logger.info({ leaveYearId: id, userId: principal.userId }, 'leave year updated');
    return this.findOwnedOrThrow(principal, id);
  }

  /** Load an active row and verify ownership (see {@link assertOwned}). */
  private async findOwnedOrThrow(principal: Principal, id: string): Promise<LeaveYear> {
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
    item: LeaveYear | null,
    id: string,
  ): asserts item is LeaveYear {
    if (!item) {
      throw new NotFoundError('Leave year not found.');
    }
    if (!principal.owns(item)) {
      this.logger.warn(
        { leaveYearId: id, userId: principal.userId },
        'authorisation denied: not the owner',
      );
      throw new NotFoundError('Leave year not found.');
    }
  }
}
