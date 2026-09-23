import { ApiProperty } from '@nestjs/swagger';

import { IsMondayDate } from '../../../../common/validation/dates';

/**
 * Switch a week's conversion on (docs/features/hours-tracker.md → Rule 6).
 * There is NO owner field: the owner is always the authenticated principal.
 */
export class CreateExcessConversionDto {
  @ApiProperty({ format: 'date', example: '2026-10-05', description: "The week's Monday." })
  @IsMondayDate()
  weekStart!: string;
}
