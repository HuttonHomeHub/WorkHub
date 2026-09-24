import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BALANCE_CAP_MAX_MINUTES,
  CONVERSION_BLOCK_DEFAULT_MINUTES,
  CONVERSION_BLOCK_MAX_MINUTES,
  CONVERSION_BLOCK_MIN_MINUTES,
  MINUTES_PER_DAY,
} from '@repo/types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { IsMondayDate, IsTimeOfDay } from '../../../../common/validation/dates';
import { IsOmittable } from '../../../../common/validation/optional';

import { WeekdayMinimumsDto, WeekdayTargetsDto } from './weekday-minutes.dto';

/**
 * Request body for new work terms, effective from a Monday
 * (docs/features/hours-tracker.md → Data model). Omitted fields take the
 * owner's defaults. There is NO owner field: the owner is always the
 * authenticated principal (ADR-0016).
 */
export class CreateWorkTermDto {
  @ApiProperty({ format: 'date', example: '2026-10-05', description: 'A Monday.' })
  @IsMondayDate()
  effectiveFrom!: string;

  @ApiPropertyOptional({
    type: WeekdayTargetsDto,
    description: 'Flexi target per weekday; null makes the day non-working.',
  })
  @IsOmittable()
  // IsObject rejects arrays, which ValidateNested would accept element-wise.
  @IsObject()
  @ValidateNested()
  @Type(() => WeekdayTargetsDto)
  targetMinutes?: WeekdayTargetsDto;

  @ApiPropertyOptional({
    type: WeekdayMinimumsDto,
    description: 'Warning-only minimum per weekday; null where the target is null.',
  })
  @IsOmittable()
  @IsObject()
  @ValidateNested()
  @Type(() => WeekdayMinimumsDto)
  minimumMinutes?: WeekdayMinimumsDto;

  @ApiPropertyOptional({ minimum: 0, maximum: MINUTES_PER_DAY, default: 360 })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  breakThresholdMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MINUTES_PER_DAY, default: 30 })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  breakMinimumMinutes?: number;

  @ApiPropertyOptional({ example: '07:00', default: '07:00', description: 'HH:MM' })
  @IsOmittable()
  @IsTimeOfDay()
  bandStart?: string;

  @ApiPropertyOptional({
    example: '19:00',
    default: '19:00',
    description: 'HH:MM, after bandStart',
  })
  @IsOmittable()
  @IsTimeOfDay()
  bandEnd?: string;

  @ApiPropertyOptional({ default: false })
  @IsOmittable()
  @IsBoolean()
  paidOvertimeAllowed?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: BALANCE_CAP_MAX_MINUTES, default: 450 })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(BALANCE_CAP_MAX_MINUTES)
  toilMonthlyCapMinutes?: number;

  @ApiPropertyOptional({
    minimum: CONVERSION_BLOCK_MIN_MINUTES,
    maximum: CONVERSION_BLOCK_MAX_MINUTES,
    default: CONVERSION_BLOCK_DEFAULT_MINUTES,
    description:
      'Conversion turns whole blocks of this many minutes into TOIL and overtime; the rest of the week’s excess stays as flexi.',
  })
  @IsOmittable()
  @IsInt()
  @Min(CONVERSION_BLOCK_MIN_MINUTES)
  @Max(CONVERSION_BLOCK_MAX_MINUTES)
  conversionBlockMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MINUTES_PER_DAY, default: 450 })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  leaveDayMaxMinutes?: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: BALANCE_CAP_MAX_MINUTES,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(BALANCE_CAP_MAX_MINUTES)
  flexiCreditCapMinutes?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: BALANCE_CAP_MAX_MINUTES,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(BALANCE_CAP_MAX_MINUTES)
  flexiDebitCapMinutes?: number | null;
}
