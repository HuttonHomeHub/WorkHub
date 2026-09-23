import { ApiProperty } from '@nestjs/swagger';
import { TimeAdjustmentBalance, TimeAdjustmentReason, type TimeAdjustment } from '@prisma/client';

import { fromDbDate } from '../../../../common/dates';

/**
 * Public representation of a time adjustment. Internal columns (`deletedAt`)
 * are intentionally NOT exposed.
 */
export class TimeAdjustmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The owning user.' })
  ownerId!: string;

  @ApiProperty({ format: 'date' })
  effectiveDate!: string;

  @ApiProperty({ enum: TimeAdjustmentBalance })
  balance!: TimeAdjustmentBalance;

  @ApiProperty({ description: 'Signed minutes.' })
  minutes!: number;

  @ApiProperty({ enum: TimeAdjustmentReason })
  reason!: TimeAdjustmentReason;

  @ApiProperty({ description: 'Optimistic-locking version.' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  /** Map a persisted entity to its safe API representation. */
  static from(entity: TimeAdjustment): TimeAdjustmentResponseDto {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      effectiveDate: fromDbDate(entity.effectiveDate),
      balance: entity.balance,
      minutes: entity.minutes,
      reason: entity.reason,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
