import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { IsHoursDate } from '../../../../common/validation/dates';

/**
 * A summary range: `[from, to)`, at most 366 days (docs/API.md → Computed
 * read-models), grouped by day, week or month, as of the caller's today.
 */
export class TimeSummariesQueryDto {
  @ApiProperty({ format: 'date', description: 'Start (inclusive).' })
  @IsHoursDate()
  from!: string;

  @ApiProperty({ format: 'date', description: 'End (exclusive); after from, at most 366 days on.' })
  @IsHoursDate()
  to!: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'week' })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy: 'day' | 'week' | 'month' = 'week';

  @ApiProperty({
    format: 'date',
    description: 'Today in Europe/London, from the caller: what counts and what has settled.',
  })
  @IsHoursDate()
  asOf!: string;
}
