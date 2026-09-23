import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

import { CreateWorkTermDto } from './create-work-term.dto';

/**
 * Request body for updating work terms. `effectiveFrom` is fixed: to change
 * when terms apply, add new terms from the new Monday. `version` is the
 * expected current version for optimistic locking. An explicit `null` on any
 * other field is a 422 (skipNullProperties) (docs/DATABASE.md) — a
 * mismatch yields 409.
 */
export class UpdateWorkTermDto extends PartialType(OmitType(CreateWorkTermDto, ['effectiveFrom']), {
  skipNullProperties: false,
}) {
  @ApiProperty({ minimum: 1, description: 'Expected current version (optimistic locking).' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647) // INT4: a larger value would overflow in the query (500)
  version!: number;
}
