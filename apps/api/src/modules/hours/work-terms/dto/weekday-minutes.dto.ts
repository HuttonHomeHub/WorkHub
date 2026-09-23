import { ApiProperty } from '@nestjs/swagger';
import { MINUTES_PER_DAY, type Weekday } from '@repo/types';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

/**
 * Minutes per weekday, Monday first. Every key is required; `null` means "not
 * set" (a non-working day for targets, no warning for minimums). A present
 * number is validated; a missing key fails `IsInt`.
 */
function weekdayMinutes(minimum: number): PropertyDecorator {
  return (target, key) => {
    ApiProperty({ type: Number, nullable: true, minimum, maximum: MINUTES_PER_DAY })(target, key);
    ValidateIf((dto: Record<Weekday, number | null>) => dto[key as Weekday] !== null)(target, key);
    IsInt()(target, key);
    Min(minimum)(target, key);
    Max(MINUTES_PER_DAY)(target, key);
  };
}

/** Flexi targets: a working day's target is at least one minute. */
export class WeekdayTargetsDto implements Record<Weekday, number | null> {
  @weekdayMinutes(1) mon!: number | null;
  @weekdayMinutes(1) tue!: number | null;
  @weekdayMinutes(1) wed!: number | null;
  @weekdayMinutes(1) thu!: number | null;
  @weekdayMinutes(1) fri!: number | null;
  @weekdayMinutes(1) sat!: number | null;
  @weekdayMinutes(1) sun!: number | null;
}

/** Warning-only minimums. */
export class WeekdayMinimumsDto implements Record<Weekday, number | null> {
  @weekdayMinutes(0) mon!: number | null;
  @weekdayMinutes(0) tue!: number | null;
  @weekdayMinutes(0) wed!: number | null;
  @weekdayMinutes(0) thu!: number | null;
  @weekdayMinutes(0) fri!: number | null;
  @weekdayMinutes(0) sat!: number | null;
  @weekdayMinutes(0) sun!: number | null;
}
