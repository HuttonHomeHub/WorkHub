import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

import { CreateLeaveYearDto } from './create-leave-year.dto';

/**
 * Request body for updating a leave year. The year itself is fixed. `version`
 * is the expected current version for optimistic locking — a mismatch is 409.
 */
export class UpdateLeaveYearDto extends PartialType(OmitType(CreateLeaveYearDto, ['year']), {
  skipNullProperties: false,
}) {
  @ApiProperty({ minimum: 1, description: 'Expected current version (optimistic locking).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647) // INT4: a larger value would overflow in the query (500)
  version!: number;
}
