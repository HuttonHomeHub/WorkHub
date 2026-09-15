import type { PageMeta } from '@repo/types';
import { Injectable } from '@nestjs/common';
import { Prisma, type ReferenceItem } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { Principal } from '../../common/auth/principal';
import { ConflictError, NotFoundError } from '../../common/errors/domain-errors';

import type { CreateReferenceItemDto } from './dto/create-reference-item.dto';
import type { ListReferenceItemsQueryDto } from './dto/list-reference-items-query.dto';
import type { UpdateReferenceItemDto } from './dto/update-reference-item.dto';
import { ReferenceRepository } from './reference.repository';

/**
 * Reference service — the **business-logic layer** template. It orchestrates the
 * use case: authorise, apply rules, delegate persistence to the repository, and
 * log. It contains NO HTTP concerns (that's the controller) and NO raw Prisma
 * queries (that's the repository). Demonstrates owner-scoped authorisation
 * (anti-IDOR, ADR-0016), auditing, optimistic locking, and cursor pagination.
 * See docs/REFERENCE_FEATURE.md.
 */
@Injectable()
export class ReferenceService {
  constructor(
    private readonly repository: ReferenceRepository,
    @InjectPinoLogger(ReferenceService.name) private readonly logger: PinoLogger,
  ) {}

  async create(principal: Principal, dto: CreateReferenceItemDto): Promise<ReferenceItem> {
    const data: Prisma.ReferenceItemCreateInput = {
      // The owner is ALWAYS the authenticated principal — never client input.
      ownerId: principal.userId,
      name: dto.name,
      description: dto.description ?? null,
      // Auditing: attribute the write to the acting principal.
      createdBy: principal.userId,
      updatedBy: principal.userId,
    };
    if (dto.status !== undefined) data.status = dto.status;

    const created = await this.repository.create(data);
    this.logger.info(
      { referenceItemId: created.id, userId: principal.userId },
      'reference item created',
    );
    return created;
  }

  async list(
    principal: Principal,
    query: ListReferenceItemsQueryDto,
  ): Promise<{ items: ReferenceItem[]; meta: PageMeta }> {
    // Every list is scoped to the caller's own rows — the WHERE clause is the
    // authorisation (ADR-0016).
    const where: Prisma.ReferenceItemWhereInput = {
      ownerId: principal.userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
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

  async getById(principal: Principal, id: string): Promise<ReferenceItem> {
    return this.findOwnedOrThrow(principal, id);
  }

  async update(
    principal: Principal,
    id: string,
    dto: UpdateReferenceItemDto,
  ): Promise<ReferenceItem> {
    await this.findOwnedOrThrow(principal, id);

    const data: Prisma.ReferenceItemUpdateManyMutationInput = {
      version: { increment: 1 },
      updatedBy: principal.userId,
    };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;

    const changed = await this.repository.updateIfVersionMatches(id, dto.version, data);
    if (changed === 0) {
      this.logger.warn(
        { referenceItemId: id, expectedVersion: dto.version, userId: principal.userId },
        'optimistic-lock conflict on update',
      );
      throw new ConflictError('This item was modified elsewhere. Refetch it and try again.');
    }

    this.logger.info({ referenceItemId: id, userId: principal.userId }, 'reference item updated');
    return this.findOwnedOrThrow(principal, id);
  }

  async remove(principal: Principal, id: string): Promise<void> {
    await this.findOwnedOrThrow(principal, id);

    await this.repository.softDelete(id, principal.userId);
    this.logger.info(
      { referenceItemId: id, userId: principal.userId },
      'reference item soft-deleted',
    );
  }

  /**
   * Load a row and verify ownership — the authoritative authorisation check
   * (anti-IDOR). A row owned by someone else yields the SAME 404 as a missing
   * row, so an attacker cannot probe which ids exist (ADR-0016).
   */
  private async findOwnedOrThrow(principal: Principal, id: string): Promise<ReferenceItem> {
    const item = await this.repository.findActiveById(id);
    if (!item) {
      throw new NotFoundError('Reference item not found.');
    }
    if (!principal.owns(item)) {
      this.logger.warn(
        { referenceItemId: id, userId: principal.userId },
        'authorisation denied: not the owner',
      );
      throw new NotFoundError('Reference item not found.');
    }
    return item;
  }
}
