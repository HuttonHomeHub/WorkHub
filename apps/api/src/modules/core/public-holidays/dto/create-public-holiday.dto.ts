import { ApiProperty } from '@nestjs/swagger';
import { NO_CONTROL_CHARACTERS_PATTERN, PUBLIC_HOLIDAY_NAME_MAX_LENGTH } from '@repo/types';
import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

import { IsHoursDate } from '../../../../common/validation/dates';

/**
 * Request body for adding a public holiday by hand. There is NO owner field:
 * the owner is always the authenticated principal (ADR-0016).
 */
export class CreatePublicHolidayDto {
  @ApiProperty({ format: 'date', example: '2026-12-25' })
  @IsHoursDate()
  date!: string;

  @ApiProperty({
    minLength: 1,
    maxLength: PUBLIC_HOLIDAY_NAME_MAX_LENGTH,
    example: 'Christmas Day',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(PUBLIC_HOLIDAY_NAME_MAX_LENGTH)
  @Matches(NO_CONTROL_CHARACTERS_PATTERN, { message: 'name must be a single line of text' })
  name!: string;
}
