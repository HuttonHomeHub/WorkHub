import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

import { CreateWorkDayDto } from './create-work-day.dto';

/**
 * Request body for updating a work day. The date is fixed. `null` clears the
 * times (send both); on any other field it is a 422. `version` is the expected
 * current version for optimistic locking — a mismatch yields 409.
 */
export class UpdateWorkDayDto extends PartialType(OmitType(CreateWorkDayDto, ['date']), {
  skipNullProperties: false,
}) {
  @ApiProperty({ minimum: 1, description: 'Expected current version (optimistic locking).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647) // INT4: a larger value would overflow in the query (500)
  version!: number;
}
