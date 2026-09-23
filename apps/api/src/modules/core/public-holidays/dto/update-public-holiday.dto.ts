import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

import { CreatePublicHolidayDto } from './create-public-holiday.dto';

/**
 * Request body for updating a public holiday. `version` is the expected current
 * version for optimistic locking — a mismatch yields 409.
 */
export class UpdatePublicHolidayDto extends PartialType(CreatePublicHolidayDto, {
  skipNullProperties: false,
}) {
  @ApiProperty({ minimum: 1, description: 'Expected current version (optimistic locking).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647) // INT4: a larger value would overflow in the query (500)
  version!: number;
}
