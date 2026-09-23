import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/**
 * Query params for listing work terms, scoped to the caller (ADR-0016).
 * Sorted by `effectiveFrom`, latest first by default.
 */
export class ListWorkTermsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['effectiveFrom', 'createdAt'], default: 'effectiveFrom' })
  @IsOptional()
  @IsIn(['effectiveFrom', 'createdAt'])
  sort: 'effectiveFrom' | 'createdAt' = 'effectiveFrom';
}
