import { ApiProperty } from '@nestjs/swagger';
import { type WorkDay } from '@prisma/client';

import { fromDbDate } from '../../../../common/dates';

/**
 * Public representation of a work day. Internal columns (`deletedAt`) are
 * intentionally NOT exposed.
 */
export class WorkDayResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The owning user.' })
  ownerId!: string;

  @ApiProperty({ format: 'date' })
  date!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  startsAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  endsAt!: string | null;

  @ApiProperty({ description: 'The recorded break; rule 3 may deduct more.' })
  breakMinutes!: number;

  @ApiProperty()
  leaveMinutes!: number;

  @ApiProperty()
  toilTakenMinutes!: number;

  @ApiProperty()
  bankHolidayWorked!: boolean;

  @ApiProperty({ description: 'Optimistic-locking version.' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  /** Map a persisted entity to its safe API representation. */
  static from(entity: WorkDay): WorkDayResponseDto {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      date: fromDbDate(entity.date),
      startsAt: entity.startsAt?.toISOString() ?? null,
      endsAt: entity.endsAt?.toISOString() ?? null,
      breakMinutes: entity.breakMinutes,
      leaveMinutes: entity.leaveMinutes,
      toilTakenMinutes: entity.toilTakenMinutes,
      bankHolidayWorked: entity.bankHolidayWorked,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
