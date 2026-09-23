import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MINUTES_PER_DAY } from '@repo/types';
import { IsBoolean, IsInt, IsOptional, Max, Min, ValidateIf } from 'class-validator';

import { IsHoursDate, IsIsoInstant } from '../../../../common/validation/dates';
import { IsOmittable } from '../../../../common/validation/optional';

/**
 * Request body for a work day: one row per date (docs/features/hours-tracker.md
 * → Data model). Times are instants; an end on the next day is a night shift
 * that counts wholly to `date`. There is NO owner field: the owner is always
 * the authenticated principal (ADR-0016).
 */
export class CreateWorkDayDto {
  @ApiProperty({ format: 'date', example: '2026-10-05' })
  @IsHoursDate()
  date!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Start instant (UTC, with Z); on `date` in Europe/London. Null with endsAt.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIsoInstant()
  startsAt?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'End instant (UTC, with Z), after startsAt and within 24 hours.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIsoInstant()
  endsAt?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: MINUTES_PER_DAY, default: 0 })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  breakMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MINUTES_PER_DAY, default: 0 })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  leaveMinutes?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MINUTES_PER_DAY, default: 0 })
  @IsOmittable()
  @IsInt()
  @Min(0)
  @Max(MINUTES_PER_DAY)
  toilTakenMinutes?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'On a bank holiday: worked, so no holiday credit.',
  })
  @IsOmittable()
  @IsBoolean()
  bankHolidayWorked?: boolean;
}
