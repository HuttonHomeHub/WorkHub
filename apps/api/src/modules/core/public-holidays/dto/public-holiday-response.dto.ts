import { ApiProperty } from '@nestjs/swagger';
import { type PublicHoliday } from '@prisma/client';

import { fromDbDate } from '../../../../common/dates';

/**
 * Public representation of a public holiday. Internal columns (`deletedAt`)
 * are intentionally NOT exposed.
 */
export class PublicHolidayResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The owning user.' })
  ownerId!: string;

  @ApiProperty({ format: 'date' })
  date!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: 'Optimistic-locking version.' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  /** Map a persisted entity to its safe API representation. */
  static from(entity: PublicHoliday): PublicHolidayResponseDto {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      date: fromDbDate(entity.date),
      name: entity.name,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
