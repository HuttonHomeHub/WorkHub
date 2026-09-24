import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const WARNING_CODES = [
  'BELOW_MINIMUM',
  'OUTSIDE_BAND',
  'MISSING_DAY',
  'FLEXI_CREDIT_CAP',
  'FLEXI_DEBIT_CAP',
  'TOIL_UNUSED',
  'TOIL_NOT_EARNED',
  'LEAVE_OVER_ALLOWANCE',
  'BREAK_RAISED',
  'INVALID_SPAN',
  'TIME_OFF_OVER_TARGET',
] as const;

/** A warning never changes a number (rule 13). */
export class HoursWarningDto {
  @ApiProperty({ enum: WARNING_CODES })
  code!: (typeof WARNING_CODES)[number];

  @ApiProperty({ format: 'date' })
  date!: string;
}

/** One group of `time-summaries` (docs/features/hours-tracker.md → API). */
export class SummaryGroupDto {
  @ApiProperty({ description: 'The date, the week’s Monday, or YYYY-MM.' })
  key!: string;

  @ApiProperty({ format: 'date', description: 'First day of the group.' })
  start!: string;

  @ApiProperty({ format: 'date', description: 'Day after the group (exclusive).' })
  end!: string;

  @ApiProperty() targetMinutes!: number;
  @ApiProperty() creditedMinutes!: number;
  @ApiProperty() workedMinutes!: number;
  @ApiProperty() leaveMinutes!: number;
  @ApiProperty() bankHolidayMinutes!: number;
  @ApiProperty() rawFlexiMinutes!: number;
  @ApiProperty() convertedMinutes!: number;

  @ApiProperty({
    description: 'Day flexi less month-end debits; adjustments are in the balance only.',
  })
  flexiMinutes!: number;

  @ApiProperty() toilMinutes!: number;
  @ApiProperty() toilTakenMinutes!: number;
  @ApiProperty() toilUnusedMinutes!: number;
  @ApiProperty() overtimePaidMinutes!: number;
  @ApiProperty() overtimeUnpaidMinutes!: number;

  @ApiProperty({ description: 'Flexi balance at the end of the group, adjustments included.' })
  flexiBalanceEndMinutes!: number;

  @ApiPropertyOptional({ enum: ['OFF', 'PREVIEW', 'APPLIED'], description: 'Week groups only.' })
  conversion?: 'OFF' | 'PREVIEW' | 'APPLIED';

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description: 'Week groups only: the last working day.',
  })
  settlementDate?: string | null;

  @ApiPropertyOptional({ description: 'Week groups only: E, the net positive flexi.' })
  excessMinutes?: number;

  @ApiPropertyOptional({
    description: 'Week groups only: the conversion block in the week’s terms (rule 6).',
  })
  conversionBlockMinutes?: number;

  @ApiPropertyOptional({
    description:
      'Week groups only: the whole blocks of E the conversion takes, preview or applied (0 when off); the rest of E stays as flexi.',
  })
  conversionMinutes?: number;

  @ApiPropertyOptional({
    description: 'Week groups only: TOIL from the conversion (preview or applied).',
  })
  conversionToilMinutes?: number;

  @ApiPropertyOptional({ description: 'Week groups only: paid overtime from the conversion.' })
  conversionOvertimePaidMinutes?: number;

  @ApiPropertyOptional({ description: 'Week groups only: unpaid overtime from the conversion.' })
  conversionOvertimeUnpaidMinutes?: number;

  @ApiProperty({ type: [HoursWarningDto] })
  warnings!: HoursWarningDto[];
}

/** `time-balances`, as of a date. */
export class TimeBalancesDto {
  @ApiProperty({ format: 'date' })
  asOf!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true, description: 'Null with no terms.' })
  trackingStart!: string | null;

  @ApiProperty({ description: 'Flexi balance at the end of asOf.' })
  flexiMinutes!: number;

  @ApiProperty({ description: 'TOIL converted in the month of asOf.' })
  toilMonthMinutes!: number;

  @ApiProperty() toilTakenMonthMinutes!: number;
  @ApiProperty() toilCapMinutes!: number;
  @ApiProperty() leaveAllowanceMinutes!: number;
  @ApiProperty() leaveUsedMinutes!: number;
  @ApiProperty() leaveRemainingMinutes!: number;
  @ApiProperty() overtimePaidYearMinutes!: number;
  @ApiProperty() overtimeUnpaidYearMinutes!: number;
}
