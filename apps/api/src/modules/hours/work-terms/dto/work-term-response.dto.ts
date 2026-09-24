import { ApiProperty } from '@nestjs/swagger';
import { type WorkTerm } from '@prisma/client';

import { fromDbDate, fromDbTime } from '../../../../common/dates';

/** Minutes per weekday in a response; `null` means not set. */
export class WeekdayMinutesResponseDto {
  @ApiProperty({ type: Number, nullable: true }) mon!: number | null;
  @ApiProperty({ type: Number, nullable: true }) tue!: number | null;
  @ApiProperty({ type: Number, nullable: true }) wed!: number | null;
  @ApiProperty({ type: Number, nullable: true }) thu!: number | null;
  @ApiProperty({ type: Number, nullable: true }) fri!: number | null;
  @ApiProperty({ type: Number, nullable: true }) sat!: number | null;
  @ApiProperty({ type: Number, nullable: true }) sun!: number | null;
}

/**
 * Public representation of work terms. Internal columns (`deletedAt`) are
 * intentionally NOT exposed.
 */
export class WorkTermResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'The owning user.' })
  ownerId!: string;

  @ApiProperty({ format: 'date', description: 'The Monday these terms apply from.' })
  effectiveFrom!: string;

  @ApiProperty({ type: WeekdayMinutesResponseDto })
  targetMinutes!: WeekdayMinutesResponseDto;

  @ApiProperty({ type: WeekdayMinutesResponseDto })
  minimumMinutes!: WeekdayMinutesResponseDto;

  @ApiProperty()
  breakThresholdMinutes!: number;

  @ApiProperty()
  breakMinimumMinutes!: number;

  @ApiProperty({ example: '07:00' })
  bandStart!: string;

  @ApiProperty({ example: '19:00' })
  bandEnd!: string;

  @ApiProperty()
  paidOvertimeAllowed!: boolean;

  @ApiProperty()
  toilMonthlyCapMinutes!: number;

  @ApiProperty({ description: 'Conversion turns whole blocks of this many minutes (rule 6).' })
  conversionBlockMinutes!: number;

  @ApiProperty()
  leaveDayMaxMinutes!: number;

  @ApiProperty({ type: Number, nullable: true })
  flexiCreditCapMinutes!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  flexiDebitCapMinutes!: number | null;

  @ApiProperty({ description: 'Optimistic-locking version.' })
  version!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  /** Map a persisted entity to its safe API representation. */
  static from(entity: WorkTerm): WorkTermResponseDto {
    return {
      id: entity.id,
      ownerId: entity.ownerId,
      effectiveFrom: fromDbDate(entity.effectiveFrom),
      targetMinutes: {
        mon: entity.targetMinutesMon,
        tue: entity.targetMinutesTue,
        wed: entity.targetMinutesWed,
        thu: entity.targetMinutesThu,
        fri: entity.targetMinutesFri,
        sat: entity.targetMinutesSat,
        sun: entity.targetMinutesSun,
      },
      minimumMinutes: {
        mon: entity.minMinutesMon,
        tue: entity.minMinutesTue,
        wed: entity.minMinutesWed,
        thu: entity.minMinutesThu,
        fri: entity.minMinutesFri,
        sat: entity.minMinutesSat,
        sun: entity.minMinutesSun,
      },
      breakThresholdMinutes: entity.breakThresholdMinutes,
      breakMinimumMinutes: entity.breakMinimumMinutes,
      bandStart: fromDbTime(entity.bandStart),
      bandEnd: fromDbTime(entity.bandEnd),
      paidOvertimeAllowed: entity.paidOvertimeAllowed,
      toilMonthlyCapMinutes: entity.toilMonthlyCapMinutes,
      conversionBlockMinutes: entity.conversionBlockMinutes,
      leaveDayMaxMinutes: entity.leaveDayMaxMinutes,
      flexiCreditCapMinutes: entity.flexiCreditCapMinutes,
      flexiDebitCapMinutes: entity.flexiDebitCapMinutes,
      version: entity.version,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
