import { Injectable } from '@nestjs/common';
import { Prisma, type WorkTerm } from '@prisma/client';
import type { PageMeta, Weekday } from '@repo/types';
import { CONVERSION_BLOCK_DEFAULT_MINUTES, WEEKDAYS } from '@repo/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { Principal } from '../../../common/auth/principal';
import { dbTimeMinutes, fromDbTime, toDbDate, toDbTime } from '../../../common/dates';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../common/errors/domain-errors';
import { PrismaService } from '../../../prisma/prisma.service';

import type { CreateWorkTermDto } from './dto/create-work-term.dto';
import type { ListWorkTermsQueryDto } from './dto/list-work-terms-query.dto';
import type { UpdateWorkTermDto } from './dto/update-work-term.dto';
import { WorkTermsRepository } from './work-terms.repository';

type WeekdayMinutes = Record<Weekday, number | null>;

/** Every setting a row of work terms holds, in API shape. */
interface TermsValues {
  targetMinutes: WeekdayMinutes;
  minimumMinutes: WeekdayMinutes;
  breakThresholdMinutes: number;
  breakMinimumMinutes: number;
  bandStart: string;
  bandEnd: string;
  paidOvertimeAllowed: boolean;
  toilMonthlyCapMinutes: number;
  conversionBlockMinutes: number;
  leaveDayMaxMinutes: number;
  flexiCreditCapMinutes: number | null;
  flexiDebitCapMinutes: number | null;
}

/** The owner's defaults (docs/features/hours-tracker.md → Data model). */
const DEFAULTS: TermsValues = {
  targetMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 450, sat: null, sun: null },
  minimumMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 330, sat: null, sun: null },
  breakThresholdMinutes: 360,
  breakMinimumMinutes: 30,
  bandStart: '07:00',
  bandEnd: '19:00',
  paidOvertimeAllowed: false,
  toilMonthlyCapMinutes: 450,
  conversionBlockMinutes: CONVERSION_BLOCK_DEFAULT_MINUTES,
  leaveDayMaxMinutes: 450,
  flexiCreditCapMinutes: null,
  flexiDebitCapMinutes: null,
};

const COLUMN: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/**
 * Work terms service — effective-dated settings for the hours tool. On top of
 * the template's ownership, optimistic locking and soft delete, it applies the
 * defaults, keeps each minimum consistent with its target, and refuses to
 * delete the last remaining terms (feature doc → API).
 */
@Injectable()
export class WorkTermsService {
  constructor(
    private readonly repository: WorkTermsRepository,
    // Only to open the delete transaction (docs/DATABASE.md → Transactions).
    private readonly prisma: PrismaService,
    @InjectPinoLogger(WorkTermsService.name) private readonly logger: PinoLogger,
  ) {}

  async create(principal: Principal, dto: CreateWorkTermDto): Promise<WorkTerm> {
    const values = merge(DEFAULTS, dto);
    // A duplicate Monday is a 409 from the partial unique index (P2002).
    const created = await this.repository.create({
      ownerId: principal.userId,
      effectiveFrom: toDbDate(dto.effectiveFrom),
      ...toColumns(values),
    });
    this.logger.info({ workTermId: created.id, userId: principal.userId }, 'work terms created');
    return created;
  }

  async list(
    principal: Principal,
    query: ListWorkTermsQueryDto,
  ): Promise<{ items: WorkTerm[]; meta: PageMeta }> {
    const rows = await this.repository.findManyActive({
      where: { ownerId: principal.userId },
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
   * The caller's terms in force on a date (rule 1), or `null` before the
   * tracking start. Exported for the tool's other modules.
   */
  async findInForce(principal: Principal, date: string): Promise<WorkTerm | null> {
    return this.repository.findInForce(principal.userId, toDbDate(date));
  }

  /** The caller's active terms, for the hours calculation. */
  async listForCalculation(principal: Principal): Promise<WorkTerm[]> {
    return this.repository.findAllActive({
      where: { ownerId: principal.userId },
      orderBy: [{ effectiveFrom: 'asc' }],
    });
  }

  async getById(principal: Principal, id: string): Promise<WorkTerm> {
    return this.findOwnedOrThrow(principal, id);
  }

  async update(principal: Principal, id: string, dto: UpdateWorkTermDto): Promise<WorkTerm> {
    const current = await this.findOwnedOrThrow(principal, id);
    const values = merge(valuesOf(current), dto);

    const changed = await this.repository.updateIfVersionMatches(id, dto.version, {
      ...toColumns(values),
      version: { increment: 1 },
    });
    if (changed === 0) {
      this.logger.warn(
        { workTermId: id, expectedVersion: dto.version, userId: principal.userId },
        'optimistic-lock conflict on update',
      );
      throw new ConflictError('These terms were modified elsewhere. Refetch them and try again.');
    }
    this.logger.info({ workTermId: id, userId: principal.userId }, 'work terms updated');
    return this.findOwnedOrThrow(principal, id);
  }

  async remove(principal: Principal, id: string): Promise<void> {
    await this.findOwnedOrThrow(principal, id);
    // Hours need terms from the tracking start, so the last row stays. The
    // check and the delete share a transaction that locks the owner's terms.
    await this.prisma.$transaction(async (tx) => {
      const active = await this.repository.lockActiveIdsForOwner(principal.userId, tx);
      if (!active.includes(id)) throw new NotFoundError('Work terms not found.');
      if (active.length <= 1) {
        throw new ValidationError(
          'You cannot delete your only work terms. Add new terms first, or edit these.',
        );
      }
      await this.repository.softDelete(id, tx);
    });
    this.logger.info({ workTermId: id, userId: principal.userId }, 'work terms soft-deleted');
  }

  /**
   * Undo a soft delete; idempotent, and a 409 if active terms now start on the
   * same Monday (see the template's restore).
   */
  async restore(principal: Principal, id: string): Promise<WorkTerm> {
    const item = await this.repository.findById(id);
    this.assertOwned(principal, item, id);
    if (item.deletedAt === null) return item;

    if ((await this.repository.restore(id)) > 0) {
      this.logger.info({ workTermId: id, userId: principal.userId }, 'work terms restored');
    }
    return this.findOwnedOrThrow(principal, id);
  }

  private async findOwnedOrThrow(principal: Principal, id: string): Promise<WorkTerm> {
    const item = await this.repository.findActiveById(id);
    this.assertOwned(principal, item, id);
    return item;
  }

  /** Ownership check (anti-IDOR): another owner's row is the same 404 (ADR-0016). */
  private assertOwned(
    principal: Principal,
    item: WorkTerm | null,
    id: string,
  ): asserts item is WorkTerm {
    if (!item) throw new NotFoundError('Work terms not found.');
    if (!principal.owns(item)) {
      this.logger.warn(
        { workTermId: id, userId: principal.userId },
        'authorisation denied: not the owner',
      );
      throw new NotFoundError('Work terms not found.');
    }
  }
}

/** A stored row's settings in API shape. */
function valuesOf(row: WorkTerm): TermsValues {
  const weekdays = (prefix: 'targetMinutes' | 'minMinutes'): WeekdayMinutes =>
    Object.fromEntries(
      WEEKDAYS.map((day) => [
        day,
        row[`${prefix}${COLUMN[day]}` as keyof WorkTerm] as number | null,
      ]),
    ) as WeekdayMinutes;
  return {
    targetMinutes: weekdays('targetMinutes'),
    minimumMinutes: weekdays('minMinutes'),
    breakThresholdMinutes: row.breakThresholdMinutes,
    breakMinimumMinutes: row.breakMinimumMinutes,
    bandStart: fromDbTime(row.bandStart),
    bandEnd: fromDbTime(row.bandEnd),
    paidOvertimeAllowed: row.paidOvertimeAllowed,
    toilMonthlyCapMinutes: row.toilMonthlyCapMinutes,
    conversionBlockMinutes: row.conversionBlockMinutes,
    leaveDayMaxMinutes: row.leaveDayMaxMinutes,
    flexiCreditCapMinutes: row.flexiCreditCapMinutes,
    flexiDebitCapMinutes: row.flexiDebitCapMinutes,
  };
}

/**
 * Apply a create or update body to a base, then validate the whole. When the
 * targets change but the minimums are not sent, each minimum is kept but
 * cleared on a day that is no longer working and lowered to its target, so a
 * targets-only change never fails on minimums the owner did not touch.
 */
export function merge(
  base: TermsValues,
  dto: Partial<Omit<TermsValues, 'targetMinutes' | 'minimumMinutes'>> & {
    targetMinutes?: WeekdayMinutes | undefined;
    minimumMinutes?: WeekdayMinutes | undefined;
  },
): TermsValues {
  const targetMinutes = dto.targetMinutes ?? base.targetMinutes;
  let minimumMinutes = dto.minimumMinutes ?? base.minimumMinutes;
  if (dto.targetMinutes && !dto.minimumMinutes) {
    minimumMinutes = Object.fromEntries(
      WEEKDAYS.map((day) => {
        const target = targetMinutes[day];
        const minimum = minimumMinutes[day] ?? null;
        return [day, target === null || minimum === null ? null : Math.min(minimum, target)];
      }),
    ) as WeekdayMinutes;
  }
  const values: TermsValues = {
    targetMinutes,
    minimumMinutes,
    breakThresholdMinutes: dto.breakThresholdMinutes ?? base.breakThresholdMinutes,
    breakMinimumMinutes: dto.breakMinimumMinutes ?? base.breakMinimumMinutes,
    bandStart: dto.bandStart ?? base.bandStart,
    bandEnd: dto.bandEnd ?? base.bandEnd,
    paidOvertimeAllowed: dto.paidOvertimeAllowed ?? base.paidOvertimeAllowed,
    toilMonthlyCapMinutes: dto.toilMonthlyCapMinutes ?? base.toilMonthlyCapMinutes,
    conversionBlockMinutes: dto.conversionBlockMinutes ?? base.conversionBlockMinutes,
    leaveDayMaxMinutes: dto.leaveDayMaxMinutes ?? base.leaveDayMaxMinutes,
    flexiCreditCapMinutes:
      dto.flexiCreditCapMinutes !== undefined
        ? dto.flexiCreditCapMinutes
        : base.flexiCreditCapMinutes,
    flexiDebitCapMinutes:
      dto.flexiDebitCapMinutes !== undefined ? dto.flexiDebitCapMinutes : base.flexiDebitCapMinutes,
  };

  const problems: string[] = [];
  for (const day of WEEKDAYS) {
    const target = values.targetMinutes[day];
    const minimum = values.minimumMinutes[day];
    if (target === null && minimum !== null) {
      problems.push(`minimumMinutes.${day} must be null on a non-working day`);
    } else if (target !== null && minimum !== null && minimum > target) {
      problems.push(`minimumMinutes.${day} must not exceed targetMinutes.${day}`);
    }
  }
  if (dbTimeMinutes(toDbTime(values.bandEnd)) <= dbTimeMinutes(toDbTime(values.bandStart))) {
    problems.push('bandEnd must be after bandStart');
  }
  if (problems.length > 0) throw new ValidationError('The work terms are not valid.', problems);
  return values;
}

/** API-shaped settings → the table's columns. */
function toColumns(
  values: TermsValues,
): Omit<Prisma.WorkTermUncheckedCreateInput, 'ownerId' | 'effectiveFrom'> {
  const columns: Record<string, unknown> = {
    breakThresholdMinutes: values.breakThresholdMinutes,
    breakMinimumMinutes: values.breakMinimumMinutes,
    bandStart: toDbTime(values.bandStart),
    bandEnd: toDbTime(values.bandEnd),
    paidOvertimeAllowed: values.paidOvertimeAllowed,
    toilMonthlyCapMinutes: values.toilMonthlyCapMinutes,
    conversionBlockMinutes: values.conversionBlockMinutes,
    leaveDayMaxMinutes: values.leaveDayMaxMinutes,
    flexiCreditCapMinutes: values.flexiCreditCapMinutes,
    flexiDebitCapMinutes: values.flexiDebitCapMinutes,
  };
  for (const day of WEEKDAYS) {
    columns[`targetMinutes${COLUMN[day]}`] = values.targetMinutes[day];
    columns[`minMinutes${COLUMN[day]}`] = values.minimumMinutes[day];
  }
  return columns;
}
