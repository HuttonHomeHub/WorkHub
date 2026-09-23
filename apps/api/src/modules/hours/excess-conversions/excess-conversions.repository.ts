import { Injectable } from '@nestjs/common';
import { Prisma, type ExcessConversion } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Excess conversions repository — the **data-access layer** (ADR-0008). It is the
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
export class ExcessConversionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Merge a where clause with the base filter that excludes soft-deleted rows. */
  private active(where: Prisma.ExcessConversionWhereInput = {}): Prisma.ExcessConversionWhereInput {
    return { ...where, deletedAt: null };
  }

  async create(
    data: Prisma.ExcessConversionUncheckedCreateInput,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ExcessConversion> {
    return db.excessConversion.create({ data });
  }

  async findActiveById(
    id: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ExcessConversion | null> {
    return db.excessConversion.findFirst({ where: this.active({ id }) });
  }

  async findManyActive(
    params: {
      where: Prisma.ExcessConversionWhereInput;
      orderBy: Prisma.ExcessConversionOrderByWithRelationInput[];
      take: number;
      cursor?: string;
    },
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<ExcessConversion[]> {
    if (params.cursor) {
      // The cursor must be one of the caller's own active rows (the where
      // clause carries the owner). Anything else is an empty page, so another
      // owner's id looks exactly like a missing one (ADR-0016).
      const anchor = await db.excessConversion.findFirst({
        where: this.active({ ...params.where, id: params.cursor }),
        select: { id: true },
      });
      if (!anchor) return [];
    }
    return db.excessConversion.findMany({
      where: this.active(params.where),
      orderBy: params.orderBy,
      take: params.take,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });
  }

  async softDelete(id: string, db: Prisma.TransactionClient = this.prisma): Promise<void> {
    await db.excessConversion.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
