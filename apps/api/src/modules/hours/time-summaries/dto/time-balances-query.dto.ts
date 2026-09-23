import { ApiProperty } from '@nestjs/swagger';

import { IsHoursDate } from '../../../../common/validation/dates';

/** Balances as of the caller's today (Europe/London). */
export class TimeBalancesQueryDto {
  @ApiProperty({ format: 'date', description: 'Today in Europe/London, from the caller.' })
  @IsHoursDate()
  asOf!: string;
}
