import { Injectable } from '@nestjs/common';
import { Prisma, type LeaveYear } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Leave years repository — the **data-access layer** (ADR-0008). It is the
 * ONLY place that talks to Prisma for this feature, so queries live in one
 * place and the service stays free of persistence detail.
 *
 * It also centralises the **soft-delete filter**: every read goes through
 * {@link active}, so no caller can forget `deletedAt: null` (docs/DATABASE.md).
 * (A Prisma client extension could enforce this globally across all models;
 * the per-repository form keeps each feature self-contained.)
 *
 * Every method takes an optional `db` client, defaulting to the shared one, so
 * a service can run several calls in one `prisma.$transaction(async (tx) => …)`
 * by passing `tx` (docs/DATABASE.md → Transactions).
 */
@Injectable()
export class LeaveYearsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Merge a where clause with the base filter that excludes soft-deleted rows. */
  private active(where: Prisma.LeaveYearWhereInput = {}): Prisma.LeaveYearWhereInput {
    return { ...where, deletedAt: null };
  }

  async create(
    data: Prisma.LeaveYearUncheckedCreateInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<LeaveYear> {
    return db.leaveYear.create({ data });
  }

  /**
   * Every active row matching `where`, unpaginated — for the hours
   * calculation, whose callers bound `where` by owner and date range.
   */
  async findAllActive(
    params: {
      where: Prisma.LeaveYearWhereInput;
      orderBy: Prisma.LeaveYearOrderByWithRelationInput[];
    },
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<LeaveYear[]> {
    return db.leaveYear.findMany({ where: this.active(params.where), orderBy: params.orderBy });
  }

  async findActiveById(
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<LeaveYear | null> {
    return db.leaveYear.findFirst({ where: this.active({ id }) });
  }

  async findManyActive(
    params: {
      where: Prisma.LeaveYearWhereInput;
      orderBy: Prisma.LeaveYearOrderByWithRelationInput[];
      take: number;
      cursor?: string;
    },
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<LeaveYear[]> {
    if (params.cursor) {
      // The cursor must be one of the caller's own active rows (the where
      // clause carries the owner). Anything else is an empty page, so another
      // owner's id looks exactly like a missing one (ADR-0016).
      const anchor = await db.leaveYear.findFirst({
        where: this.active({ ...params.where, id: params.cursor }),
        select: { id: true },
      });
      if (!anchor) return [];
    }
    return db.leaveYear.findMany({
      where: this.active(params.where),
      orderBy: params.orderBy,
      take: params.take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  }

  /**
   * Optimistic-locked update: only touches the row if its version still matches
   * (and it isn't soft-deleted). Returns the number of rows changed — `0` means
   * a version conflict (or the row is gone), which the service maps to 409.
   */
  async updateIfVersionMatches(
    id: string,
    expectedVersion: number,
    data: Prisma.LeaveYearUpdateManyMutationInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await db.leaveYear.updateMany({
      where: this.active({ id, version: expectedVersion }),
      data,
    });
    return result.count;
  }
}
