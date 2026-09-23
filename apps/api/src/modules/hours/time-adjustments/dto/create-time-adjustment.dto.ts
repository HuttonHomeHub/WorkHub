import { ApiProperty } from '@nestjs/swagger';
import { TimeAdjustmentBalance, TimeAdjustmentReason } from '@prisma/client';
import { LARGE_MINUTES_MAX } from '@repo/types';
import { IsEnum, IsInt, Max, Min, NotEquals } from 'class-validator';

import { IsHoursDate } from '../../../../common/validation/dates';

/**
 * Request body for a time adjustment: a signed, dated change to one balance
 * (an opening balance, a confirmed forfeit, a correction). There is NO owner
 * field: the owner is always the authenticated principal (ADR-0016).
 */
export class CreateTimeAdjustmentDto {
  @ApiProperty({ format: 'date', example: '2026-10-05' })
  @IsHoursDate()
  effectiveDate!: string;

  @ApiProperty({ enum: TimeAdjustmentBalance })
  @IsEnum(TimeAdjustmentBalance)
  balance!: TimeAdjustmentBalance;

  @ApiProperty({
    minimum: -LARGE_MINUTES_MAX,
    maximum: LARGE_MINUTES_MAX,
    description:
      'Signed minutes, never 0. For LEAVE, a positive value adds to the leave remaining.',
  })
  @IsInt()
  @NotEquals(0)
  @Min(-LARGE_MINUTES_MAX)
  @Max(LARGE_MINUTES_MAX)
  minutes!: number;

  @ApiProperty({ enum: TimeAdjustmentReason })
  @IsEnum(TimeAdjustmentReason)
  reason!: TimeAdjustmentReason;
}
