import { Injectable } from '@nestjs/common';
import type { ExcessConversion, Prisma } from '@prisma/client';
import type { PageMeta } from '@repo/types';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { Principal } from '../../../common/auth/principal';
import { toDbDate } from '../../../common/dates';
import { NotFoundError } from '../../../common/errors/domain-errors';

import type { CreateExcessConversionDto } from './dto/create-excess-conversion.dto';
import type { ListExcessConversionsQueryDto } from './dto/list-excess-conversions-query.dto';
import { ExcessConversionsRepository } from './excess-conversions.repository';

/**
 * The weekly "convert this week's excess" switch (rule 6). An active row means
 * the switch is on; switching off soft-deletes it, and switching on again
 * creates a new row, so it needs no update or restore (feature doc → API).
 */
@Injectable()
export class ExcessConversionsService {
  constructor(
    private readonly repository: ExcessConversionsRepository,
    @InjectPinoLogger(ExcessConversionsService.name) private readonly logger: PinoLogger,
  ) {}

  /** Switch on; a week already on is a 409 from the partial unique index (P2002). */
  async create(principal: Principal, dto: CreateExcessConversionDto): Promise<ExcessConversion> {
    const created = await this.repository.create({
      ownerId: principal.userId,
      weekStart: toDbDate(dto.weekStart),
    });
    this.logger.info(
      { excessConversionId: created.id, userId: principal.userId },
      'excess conversion switched on',
    );
    return created;
  }

  async list(
    principal: Principal,
    query: ListExcessConversionsQueryDto,
  ): Promise<{ items: ExcessConversion[]; meta: PageMeta }> {
    const where: Prisma.ExcessConversionWhereInput = {
      ownerId: principal.userId,
      ...(query.from || query.to
        ? {
            weekStart: {
              ...(query.from ? { gte: toDbDate(query.from) } : {}),
              ...(query.to ? { lt: toDbDate(query.to) } : {}),
            },
          }
        : {}),
    };
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

  /** Switch off. */
  async remove(principal: Principal, id: string): Promise<void> {
    const item = await this.repository.findActiveById(id);
    if (!item || !principal.owns(item)) {
      if (item) {
        this.logger.warn(
          { excessConversionId: id, userId: principal.userId },
          'authorisation denied: not the owner',
        );
      }
      throw new NotFoundError('Excess conversion not found.');
    }
    await this.repository.softDelete(id);
    this.logger.info(
      { excessConversionId: id, userId: principal.userId },
      'excess conversion switched off',
    );
  }
}
