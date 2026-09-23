import { Injectable } from '@nestjs/common';
import {
  addDays,
  balancesAt,
  calculateHours,
  daysBetween,
  ENGINE_YEAR_MAX,
  ENGINE_YEAR_MIN,
  HoursInputError,
  type GroupBy,
  type HoursResult,
  lastDayOfMonth,
  maxDate,
  minDate,
  monthOf,
  summarise,
  weekStartOf,
  yearOf,
} from '@repo/domain';

import type { Principal } from '../../../common/auth/principal';
import { ValidationError } from '../../../common/errors/domain-errors';
import { PublicHolidaysService } from '../../core/public-holidays/public-holidays.service';
import { ExcessConversionsService } from '../excess-conversions/excess-conversions.service';
import { LeaveYearsService } from '../leave-years/leave-years.service';
import { TimeAdjustmentsService } from '../time-adjustments/time-adjustments.service';
import { WorkDaysService } from '../work-days/work-days.service';
import { WorkTermsService } from '../work-terms/work-terms.service';

import type { SummaryGroupDto, TimeBalancesDto } from './dto/summary-responses.dto';
import type { TimeSummariesQueryDto } from './dto/time-summaries-query.dto';
import {
  toEngineAdjustment,
  toEngineConversion,
  toEngineDay,
  toEngineHoliday,
  toEngineLeaveYear,
  toEngineTerms,
} from './to-engine';

/**
 * Runs the hours engine over the caller's rows (ADR-0020 §4, computed
 * read-models). Every figure depends on everything since the tracking start
 * (the flexi balance, month-end TOIL, the leave year), so it loads the owner's
 * rows from the tracking start to the end of the engine's range: bounded range
 * reads through each module's exported service, all owner-scoped. Nothing is
 * stored, and there is no clock: the caller passes `asOf`.
 */
@Injectable()
export class HoursCalculationService {
  constructor(
    private readonly workTerms: WorkTermsService,
    private readonly workDays: WorkDaysService,
    private readonly conversions: ExcessConversionsService,
    private readonly adjustments: TimeAdjustmentsService,
    private readonly leaveYears: LeaveYearsService,
    private readonly publicHolidays: PublicHolidaysService,
  ) {}

  /**
   * Totals by day, week or month for `[from, to)`, widened to whole groups so
   * a week or month is never cut short (docs/API.md → Computed read-models).
   */
  async summaries(principal: Principal, query: TimeSummariesQueryDto): Promise<SummaryGroupDto[]> {
    const span = daysBetween(query.from, query.to);
    if (span <= 0) throw new ValidationError('The range is not valid.', ['to must be after from']);
    if (span > MAX_RANGE_DAYS) {
      throw new ValidationError('The range is too long.', [
        `the range must be at most ${MAX_RANGE_DAYS} days`,
      ]);
    }
    const from = groupBounds(query.from, query.groupBy).start;
    const to = groupBounds(addDays(query.to, -1), query.groupBy).end;

    // The engine covers whole weeks itself; widening can reach past its
    // 2100-12-31 window, so cap what it is asked for (security review).
    const result = await this.calculate(principal, query.asOf, minDate(addDays(to, -1), LAST_DATE));
    const weeks = new Map(result.weeks.map((week) => [week.weekStart, week]));
    return summarise(result, from, to, query.groupBy).map((group) => {
      const firstDay = query.groupBy === 'month' ? `${group.key}-01` : group.key;
      const week = query.groupBy === 'week' ? weeks.get(group.key) : undefined;
      return {
        ...group,
        ...groupBounds(firstDay, query.groupBy),
        ...(week
          ? {
              settlementDate: week.settlementDate,
              excessMinutes: week.excessMinutes,
              conversionToilMinutes: week.toilMinutes,
              conversionOvertimePaidMinutes: week.overtimePaidMinutes,
              conversionOvertimeUnpaidMinutes: week.overtimeUnpaidMinutes,
            }
          : {}),
      };
    });
  }

  /** Flexi, TOIL, leave and overtime as of a date. */
  async balances(principal: Principal, asOf: string): Promise<TimeBalancesDto> {
    const result = await this.calculate(principal, asOf);
    const year = result.leaveYears.find((y) => y.year === yearOf(asOf));
    return {
      asOf,
      trackingStart: result.trackingStart,
      ...balancesAt(result, asOf),
      leaveAllowanceMinutes: year?.allowanceMinutes ?? 0,
      leaveUsedMinutes: year?.usedMinutes ?? 0,
    };
  }

  /**
   * Run the engine over the caller's rows. The DTOs keep every date inside the
   * engine's window, so `HoursInputError` means a bug; it is still a fixed
   * 422, never a 500 or the engine's message.
   */
  async calculate(principal: Principal, asOf: string, until: string = asOf): Promise<HoursResult> {
    try {
      return await this.run(principal, asOf, until);
    } catch (error) {
      if (error instanceof HoursInputError) {
        throw new ValidationError('The dates are outside the range hours can be calculated for.');
      }
      throw error;
    }
  }

  private async run(principal: Principal, asOf: string, until: string): Promise<HoursResult> {
    const terms = await this.workTerms.listForCalculation(principal);
    const first = terms[0];
    if (!first) return calculateHours({ ...EMPTY, asOf }, { until });

    // The engine covers whole weeks, months and the leave year of the
    // horizon; a week past the year's end covers its last week.
    const from = toIso(first.effectiveFrom);
    const to = `${yearOf(maxDate(asOf, until)) + 1}-01-08`;
    const [days, conversions, adjustments, leaveYears, holidays] = await Promise.all([
      this.workDays.listForCalculation(principal, from, to),
      this.conversions.listForCalculation(principal, from, to),
      // Adjustments dated before the tracking start take effect on it.
      this.adjustments.listForCalculation(principal, `${ENGINE_YEAR_MIN}-01-01`, to),
      this.leaveYears.listForCalculation(principal),
      this.publicHolidays.listForCalculation(principal, from, to),
    ]);
    return calculateHours(
      {
        terms: terms.map(toEngineTerms),
        days: days.map(toEngineDay),
        conversions: conversions.map(toEngineConversion),
        publicHolidays: holidays.map(toEngineHoliday),
        adjustments: adjustments.map(toEngineAdjustment),
        leaveYears: leaveYears.map(toEngineLeaveYear),
        asOf,
      },
      { until },
    );
  }
}

const EMPTY = {
  terms: [],
  days: [],
  conversions: [],
  publicHolidays: [],
  adjustments: [],
  leaveYears: [],
};

const toIso = (date: Date): string => date.toISOString().slice(0, 10);

const MAX_RANGE_DAYS = 366;
/** The engine's last date (`ENGINE_YEAR_MAX`). */
const LAST_DATE = `${ENGINE_YEAR_MAX}-12-31`;

/** The group containing a date: `[start, end)`. */
function groupBounds(date: string, groupBy: GroupBy): { start: string; end: string } {
  if (groupBy === 'day') return { start: date, end: addDays(date, 1) };
  if (groupBy === 'week') {
    const start = weekStartOf(date);
    return { start, end: addDays(start, 7) };
  }
  return { start: `${monthOf(date)}-01`, end: addDays(lastDayOfMonth(date), 1) };
}
