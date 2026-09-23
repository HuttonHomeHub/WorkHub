import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

import { IMPORT_FIRST_YEAR, IMPORT_LAST_YEAR } from '../england-and-wales';

import { PublicHolidayResponseDto } from './public-holiday-response.dto';

/** Request body for importing a year's bundled England and Wales bank holidays. */
export class CreatePublicHolidayImportDto {
  @ApiProperty({ minimum: IMPORT_FIRST_YEAR, maximum: IMPORT_LAST_YEAR, example: 2026 })
  @IsInt()
  @Min(IMPORT_FIRST_YEAR)
  @Max(IMPORT_LAST_YEAR)
  year!: number;
}

/** The outcome of an import: the holidays it added (none when all were present). */
export class PublicHolidayImportResponseDto {
  @ApiProperty()
  year!: number;

  @ApiProperty({
    type: [PublicHolidayResponseDto],
    description: 'The holidays added, in date order.',
  })
  added!: PublicHolidayResponseDto[];
}
