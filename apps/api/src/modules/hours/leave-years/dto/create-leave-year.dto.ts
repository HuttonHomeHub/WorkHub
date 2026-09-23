import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HOURS_YEAR_MAX, HOURS_YEAR_MIN, LARGE_MINUTES_MAX } from '@repo/types';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

import { IsOmittable } from '../../../../common/validation/optional';

/**
 * Request body for a leave year's settings. There is NO owner field: the owner
 * is always the authenticated principal (ADR-0016).
 */
export class CreateLeaveYearDto {
  @ApiProperty({ minimum: HOURS_YEAR_MIN, maximum: HOURS_YEAR_MAX, example: 2026 })
  @IsInt()
  @Min(HOURS_YEAR_MIN)
  @Max(HOURS_YEAR_MAX)
  year!: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: LARGE_MINUTES_MAX,
    default: 14850,
    description: 'The yearly allowance in minutes, bank holidays included (247:30).',
  })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(LARGE_MINUTES_MAX)
  allowanceMinutes?: number;

  @ApiPropertyOptional({ default: false, description: 'Bought leave adds 37:30 for the year.' })
  @IsOmittable()
  @IsBoolean()
  boughtLeave?: boolean;
}
