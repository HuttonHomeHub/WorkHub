import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimeAdjustmentBalance } from '@prisma/client';
import { IsEnum, IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { IsHoursDate } from '../../../../common/validation/dates';

/**
 * Query params for listing time adjustments, scoped to the caller (ADR-0016):
 * an optional `[from, to)` range on the effective date and a balance filter.
 */
export class ListTimeAdjustmentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'Effective on or after (inclusive).' })
  @IsOptional()
  @IsHoursDate()
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Effective before (exclusive).' })
  @IsOptional()
  @IsHoursDate()
  to?: string;

  @ApiPropertyOptional({ enum: TimeAdjustmentBalance, description: 'Filter by balance.' })
  @IsOptional()
  @IsEnum(TimeAdjustmentBalance)
  balance?: TimeAdjustmentBalance;

  @ApiPropertyOptional({ enum: ['effectiveDate', 'createdAt'], default: 'effectiveDate' })
  @IsOptional()
  @IsIn(['effectiveDate', 'createdAt'])
  sort: 'effectiveDate' | 'createdAt' = 'effectiveDate';
}
