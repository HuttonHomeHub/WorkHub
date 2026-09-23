import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { IsHoursDate } from '../../../../common/validation/dates';

/**
 * Query params for listing public holidays, scoped to the caller (ADR-0016):
 * an optional `[from, to)` date range, in date order (earliest first).
 */
export class ListPublicHolidaysQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'On or after (inclusive).' })
  @IsOptional()
  @IsHoursDate()
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Before (exclusive).' })
  @IsOptional()
  @IsHoursDate()
  to?: string;

  @ApiPropertyOptional({ enum: ['date', 'createdAt'], default: 'date' })
  @IsOptional()
  @IsIn(['date', 'createdAt'])
  sort: 'date' | 'createdAt' = 'date';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc', description: 'Sort direction.' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  override order: 'asc' | 'desc' = 'asc';
}
