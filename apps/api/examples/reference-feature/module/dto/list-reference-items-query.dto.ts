import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReferenceItemStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

/**
 * Query params for listing reference items. The list is always scoped to the
 * authenticated principal's own items (ADR-0016) — no scope parameter exists.
 */
export class ListReferenceItemsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReferenceItemStatus, description: 'Filter by status.' })
  @IsOptional()
  @IsEnum(ReferenceItemStatus)
  status?: ReferenceItemStatus;

  @ApiPropertyOptional({ description: 'Case-insensitive search on the name.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'name'], default: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'name'])
  sort: 'createdAt' | 'name' = 'createdAt';
}
