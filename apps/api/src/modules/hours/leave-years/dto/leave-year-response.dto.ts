import { ApiProperty } from '@nestjs/swagger';
import { type LeaveYear } from '@prisma/client';

/**
 * Public representation of a leave year. Internal columns (`deletedAt`) are
 * intentionally NOT exposed.
 */
export class LeaveYearResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The owning user.' })
  ownerId!: string;

  @ApiProperty()
  year!: number;

  @ApiProperty({ description: 'Allowance in minutes, before bought leave.' })
  allowanceMinutes!: number;

  @ApiProperty()
  boughtLeave!: boolean;

  @ApiProperty({ description: 'Optimistic-locking version.' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  /** Map a persisted entity to its safe API representation. */
  static from(entity: LeaveYear): LeaveYearResponseDto {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      year: entity.year,
      allowanceMinutes: entity.allowanceMinutes,
      boughtLeave: entity.boughtLeave,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
