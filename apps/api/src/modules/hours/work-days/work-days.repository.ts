import { Injectable } from '@nestjs/common';
import { Prisma, type WorkDay } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Work days repository — the **data-access layer** (ADR-0008). It is the
 * ONLY place that talks to Prisma for this feature, so queries live in one
 * place and the service stays free of persistence detail.
 *
 * It also centralises the **soft-delete filter**: every read goes through
 * {@link active}, so no caller can forget `deletedAt: null` (docs/DATABASE.md).
 * The one exception is {@link findById}, which restore needs.
 * (A Prisma client extension could enforce this globally across all models;
 * the per-repository form keeps each feature self-contained.)
 *
 * Every method takes an optional `db` client, defaulting to the shared one, so
 * a service can run several calls in one `prisma.$transaction(async (tx) => …)`
 * by passing `tx` (docs/DATABASE.md → Transactions).
 */
@Injectable()
export class WorkDaysRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Merge a where clause with the base filter that excludes soft-deleted rows. */
  private active(where: Prisma.WorkDayWhereInput = {}): Prisma.WorkDayWhereInput {
    return { ...where, deletedAt: null };
  }

  async create(
    data: Prisma.WorkDayUncheckedCreateInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkDay> {
    return db.workDay.create({ data });
  }

  /** The owner's active row for a date, if any. */
  async findActiveByDate(
    ownerId: string,
    date: Date,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkDay | null> {
    return db.workDay.findFirst({ where: this.active({ ownerId, date }) });
  }

  async findActiveById(
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkDay | null> {
    return db.workDay.findFirst({ where: this.active({ id }) });
  }

  /** A row by id, deleted or not — only restore may read deleted rows. */
  async findById(id: string, db: Prisma.TransactionClient = this.prisma): Promise<WorkDay | null> {
    return db.workDay.findUnique({ where: { id } });
  }

  async findManyActive(
    params: {
      where: Prisma.WorkDayWhereInput;
      orderBy: Prisma.WorkDayOrderByWithRelationInput[];
      take: number;
      cursor?: string;
    },
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkDay[]> {
    if (params.cursor) {
      // The cursor must be one of the caller's own active rows (the where
      // clause carries the owner). Anything else is an empty page, so another
      // owner's id looks exactly like a missing one (ADR-0016).
      const anchor = await db.workDay.findFirst({
        where: this.active({ ...params.where, id: params.cursor }),
        select: { id: true },
      });
      if (!anchor) return [];
    }
    return db.workDay.findMany({
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
    data: Prisma.WorkDayUpdateManyMutationInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await db.workDay.updateMany({
      where: this.active({ id, version: expectedVersion }),
      data,
    });
    return result.count;
  }

  async softDelete(id: string, db: Prisma.TransactionClient = this.prisma): Promise<void> {
    await db.workDay.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Clear `deletedAt` and bump the version, so a client holding the old
   * version cannot overwrite the restored row. Returns the rows changed — `0`
   * means it was restored (or purged) in the meantime.
   */
  async restore(id: string, db: Prisma.TransactionClient = this.prisma): Promise<number> {
    const result = await db.workDay.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null, version: { increment: 1 } },
    });
    return result.count;
  }
}
