import { Injectable } from '@nestjs/common';
import { Prisma, type WorkTerm } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Work terms repository — the **data-access layer** (ADR-0008). It is the
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
export class WorkTermsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Merge a where clause with the base filter that excludes soft-deleted rows. */
  private active(where: Prisma.WorkTermWhereInput = {}): Prisma.WorkTermWhereInput {
    return { ...where, deletedAt: null };
  }

  async create(
    data: Prisma.WorkTermUncheckedCreateInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkTerm> {
    return db.workTerm.create({ data });
  }

  /**
   * Lock the owner's active terms (`FOR UPDATE`) and return their ids. Call it
   * inside a transaction: a concurrent delete waits, then sees the committed
   * state, so the "never delete the last terms" check cannot race.
   */
  async lockActiveIdsForOwner(ownerId: string, db: Prisma.TransactionClient): Promise<string[]> {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM work_terms
      WHERE owner_id = ${ownerId}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
    return rows.map((row) => row.id);
  }

  async findActiveById(
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkTerm | null> {
    return db.workTerm.findFirst({ where: this.active({ id }) });
  }

  /** A row by id, deleted or not — only restore may read deleted rows. */
  async findById(id: string, db: Prisma.TransactionClient = this.prisma): Promise<WorkTerm | null> {
    return db.workTerm.findUnique({ where: { id } });
  }

  async findManyActive(
    params: {
      where: Prisma.WorkTermWhereInput;
      orderBy: Prisma.WorkTermOrderByWithRelationInput[];
      take: number;
      cursor?: string;
    },
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<WorkTerm[]> {
    if (params.cursor) {
      // The cursor must be one of the caller's own active rows (the where
      // clause carries the owner). Anything else is an empty page, so another
      // owner's id looks exactly like a missing one (ADR-0016).
      const anchor = await db.workTerm.findFirst({
        where: this.active({ ...params.where, id: params.cursor }),
        select: { id: true },
      });
      if (!anchor) return [];
    }
    return db.workTerm.findMany({
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
    data: Prisma.WorkTermUpdateManyMutationInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await db.workTerm.updateMany({
      where: this.active({ id, version: expectedVersion }),
      data,
    });
    return result.count;
  }

  async softDelete(id: string, db: Prisma.TransactionClient = this.prisma): Promise<void> {
    await db.workTerm.update({
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
    const result = await db.workTerm.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null, version: { increment: 1 } },
    });
    return result.count;
  }
}
