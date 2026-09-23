import { ApiProperty } from '@nestjs/swagger';
import { type ExcessConversion } from '@prisma/client';

import { fromDbDate } from '../../../../common/dates';

/** A week whose conversion switch is on. */
export class ExcessConversionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The owning user.' })
  ownerId!: string;

  @ApiProperty({ format: 'date', description: "The week's Monday." })
  weekStart!: string;

  @ApiProperty({ format: 'date-time', description: 'When the switch was turned on.' })
  createdAt!: string;

  /** Map a persisted entity to its safe API representation. */
  static from(entity: ExcessConversion): ExcessConversionResponseDto {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      weekStart: fromDbDate(entity.weekStart),
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
