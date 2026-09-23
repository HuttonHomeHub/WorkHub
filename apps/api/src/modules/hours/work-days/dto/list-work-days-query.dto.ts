import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { IsHoursDate } from '../../../../common/validation/dates';

/**
 * Query params for listing work days, scoped to the caller (ADR-0016): days in
 * `[from, to)`, in date order.
 */
export class ListWorkDaysQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'On or after (inclusive).' })
  @IsOptional()
  @IsHoursDate()
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Before (exclusive).' })
  @IsOptional()
  @IsHoursDate()
  to?: string;

  @ApiPropertyOptional({ enum: ['date'], default: 'date' })
  @IsOptional()
  @IsIn(['date'])
  sort = 'date' as const;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc', description: 'Sort direction.' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  override order: 'asc' | 'desc' = 'asc';
}
