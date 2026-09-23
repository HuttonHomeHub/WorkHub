import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { IsHoursDate } from '../../../../common/validation/dates';

/** Weeks whose switch is on, with `weekStart` in `[from, to)`, earliest first. */
export class ListExcessConversionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'date', description: 'Week start on or after (inclusive).' })
  @IsOptional()
  @IsHoursDate()
  from?: string;

  @ApiPropertyOptional({ format: 'date', description: 'Week start before (exclusive).' })
  @IsOptional()
  @IsHoursDate()
  to?: string;

  @ApiPropertyOptional({ enum: ['weekStart'], default: 'weekStart' })
  @IsOptional()
  @IsIn(['weekStart'])
  sort = 'weekStart' as const;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc', description: 'Sort direction.' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  override order: 'asc' | 'desc' = 'asc';
}
