import { Injectable } from '@nestjs/common';
import { Prisma, type WorkDay } from '@prisma/client';
import { addDays } from '@repo/domain';
import type { PageMeta } from '@repo/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { Principal } from '../../../common/auth/principal';
import { fromDbDate, toDbDate } from '../../../common/dates';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/domain-errors';
import { PublicHolidaysService } from '../../core/public-holidays/public-holidays.service';
import { WorkTermsService } from '../work-terms/work-terms.service';

import type { CreateWorkDayDto } from './dto/create-work-day.dto';
import type { ListWorkDaysQueryDto } from './dto/list-work-days-query.dto';
import type { UpdateWorkDayDto } from './dto/update-work-day.dto';
import { type WorkDayValues, workDayProblems } from './work-day-rules';
import { WorkDaysRepository } from './work-days.repository';

/**
 * Work days service — the **business-logic layer**. It orchestrates the
 * use case: authorise, apply rules, delegate persistence to the repository, and
 * log. It contains NO HTTP concerns (that's the controller) and NO raw Prisma
 * queries (that's the repository). Demonstrates owner-scoped authorisation
 * (anti-IDOR, ADR-0016), optimistic locking, soft delete with restore (undo),
 * and cursor pagination. See docs/REFERENCE_FEATURE.md.
 */
@Injectable()
export class WorkDaysService {
  constructor(
    private readonly repository: WorkDaysRepository,
    private readonly workTerms: WorkTermsService,
    private readonly publicHolidays: PublicHolidaysService,
    @InjectPinoLogger(WorkDaysService.name) private readonly logger: PinoLogger,
  ) {}

  async create(principal: Principal, dto: CreateWorkDayDto): Promise<WorkDay> {
    const values: WorkDayValues = {
      date: dto.date,
      startsAt: dto.startsAt ?? null,
      endsAt: dto.endsAt ?? null,
      breakMinutes: dto.breakMinutes ?? 0,
      leaveMinutes: dto.leaveMinutes ?? 0,
      toilTakenMinutes: dto.toilTakenMinutes ?? 0,
      bankHolidayWorked: dto.bankHolidayWorked ?? false,
    };
    await this.validate(principal, values, null);
    // "Unchecked" input takes the owner_id column directly (the checked variant
    // would require `owner: { connect }` because of the User relation).
    const data: Prisma.WorkDayUncheckedCreateInput = {
      // The owner is ALWAYS the authenticated principal — never client input.
      ownerId: principal.userId,
      ...toColumns(values),
    };
    // A second row for the date is a 409 from the partial unique index (P2002).

    const created = await this.repository.create(data);
    this.logger.info({ workDayId: created.id, userId: principal.userId }, 'work day created');
    return created;
  }

  async list(
    principal: Principal,
    query: ListWorkDaysQueryDto,
  ): Promise<{ items: WorkDay[]; meta: PageMeta }> {
    // Every list is scoped to the caller's own rows — the WHERE clause is the
    // authorisation (ADR-0016).
    const where: Prisma.WorkDayWhereInput = {
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

  async getById(principal: Principal, id: string): Promise<WorkDay> {
    return this.findOwnedOrThrow(principal, id);
  }

  async update(principal: Principal, id: string, dto: UpdateWorkDayDto): Promise<WorkDay> {
    const current = await this.findOwnedOrThrow(principal, id);
    const values: WorkDayValues = {
      ...valuesOf(current),
      ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt } : {}),
      ...(dto.breakMinutes !== undefined ? { breakMinutes: dto.breakMinutes } : {}),
      ...(dto.leaveMinutes !== undefined ? { leaveMinutes: dto.leaveMinutes } : {}),
      ...(dto.toilTakenMinutes !== undefined ? { toilTakenMinutes: dto.toilTakenMinutes } : {}),
      ...(dto.bankHolidayWorked !== undefined ? { bankHolidayWorked: dto.bankHolidayWorked } : {}),
    };
    await this.validate(principal, values, id);

    const data: Prisma.WorkDayUpdateManyMutationInput = {
      version: { increment: 1 },
    };
    Object.assign(data, toColumns(values));

    const changed = await this.repository.updateIfVersionMatches(id, dto.version, data);
    if (changed === 0) {
      this.logger.warn(
        { workDayId: id, expectedVersion: dto.version, userId: principal.userId },
        'optimistic-lock conflict on update',
      );
      throw new ConflictError('This item was modified elsewhere. Refetch it and try again.');
    }

    this.logger.info({ workDayId: id, userId: principal.userId }, 'work day updated');
    return this.findOwnedOrThrow(principal, id);
  }

  async remove(principal: Principal, id: string): Promise<void> {
    await this.findOwnedOrThrow(principal, id);

    await this.repository.softDelete(id);
    this.logger.info({ workDayId: id, userId: principal.userId }, 'work day soft-deleted');
  }

  /**
   * Undo a soft delete. Idempotent: restoring a row that is already active —
   * or that a concurrent request restored first — returns it, so a repeated
   * undo is harmless. A missing row, or one owned by someone else, is the same
   * 404 as everywhere else, after the same single read. If an active row now
   * holds the deleted row's unique key, the feature's partial unique index
   * answers 409 (`P2002`).
   */
  async restore(principal: Principal, id: string): Promise<WorkDay> {
    const item = await this.repository.findById(id);
    this.assertOwned(principal, item, id);
    if (item.deletedAt === null) return item;
    // The neighbouring days or the terms may have changed since it was
    // cleared, so a restored day must still pass the rules (422 if not).
    await this.validate(principal, valuesOf(item), id);

    if ((await this.repository.restore(id)) > 0) {
      this.logger.info({ workDayId: id, userId: principal.userId }, 'work day restored');
    }
    // Restored now or by a concurrent request; a 404 only if it was purged.
    return this.findOwnedOrThrow(principal, id);
  }

  /**
   * The rules a day must meet (work-day-rules.ts): terms in force, times,
   * rule 4's limits and night-shift collisions with the neighbouring days.
   */
  private async validate(
    principal: Principal,
    values: WorkDayValues,
    selfId: string | null,
  ): Promise<void> {
    const [terms, isBankHoliday, previous, next] = await Promise.all([
      this.workTerms.findInForce(principal, values.date),
      this.publicHolidays.isHoliday(principal, values.date),
      this.repository.findActiveByDate(principal.userId, toDbDate(addDays(values.date, -1))),
      this.repository.findActiveByDate(principal.userId, toDbDate(addDays(values.date, 1))),
    ]);
    const neighbours = {
      previousEndsAt:
        previous && previous.id !== selfId ? (previous.endsAt?.toISOString() ?? null) : null,
      nextStartsAt: next && next.id !== selfId ? (next.startsAt?.toISOString() ?? null) : null,
    };
    const problems = workDayProblems(values, terms, isBankHoliday, neighbours);
    if (problems.length > 0) throw new ValidationError('The work day is not valid.', problems);
  }

  /** Load an active row and verify ownership (see {@link assertOwned}). */
  private async findOwnedOrThrow(principal: Principal, id: string): Promise<WorkDay> {
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
    item: WorkDay | null,
    id: string,
  ): asserts item is WorkDay {
    if (!item) {
      throw new NotFoundError('Work day not found.');
    }
    if (!principal.owns(item)) {
      this.logger.warn(
        { workDayId: id, userId: principal.userId },
        'authorisation denied: not the owner',
      );
      throw new NotFoundError('Work day not found.');
    }
  }
}

/** A stored row's values in API shape. */
function valuesOf(row: WorkDay): WorkDayValues {
  return {
    date: fromDbDate(row.date),
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    breakMinutes: row.breakMinutes,
    leaveMinutes: row.leaveMinutes,
    toilTakenMinutes: row.toilTakenMinutes,
    bankHolidayWorked: row.bankHolidayWorked,
  };
}

/** API-shaped values → columns (the date is set on create only). */
interface WorkDayColumns {
  date: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  breakMinutes: number;
  leaveMinutes: number;
  toilTakenMinutes: number;
  bankHolidayWorked: boolean;
}

function toColumns(values: WorkDayValues): WorkDayColumns {
  return {
    date: toDbDate(values.date),
    startsAt: values.startsAt === null ? null : new Date(values.startsAt),
    endsAt: values.endsAt === null ? null : new Date(values.endsAt),
    breakMinutes: values.breakMinutes,
    leaveMinutes: values.leaveMinutes,
    toilTakenMinutes: values.toilTakenMinutes,
    bankHolidayWorked: values.bankHolidayWorked,
  };
}
