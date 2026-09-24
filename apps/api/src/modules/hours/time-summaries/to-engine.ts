import type {
  ExcessConversion,
  LeaveYear,
  PublicHoliday,
  TimeAdjustment,
  WorkDay,
  WorkTerm,
} from '@prisma/client';
import type {
  LeaveYearSetting,
  TimeAdjustment as EngineAdjustment,
  WorkDayRow,
  WorkTerms,
} from '@repo/domain';

import { dbTimeMinutes, fromDbDate } from '../../../common/dates';

/**
 * Stored rows → the engine's inputs (`@repo/domain`, ADR-0020 §5). Dates
 * become `YYYY-MM-DD`, instants ISO with `Z`, and the band minutes after
 * midnight. Nothing here applies a rule.
 */
export function toEngineTerms(row: WorkTerm): WorkTerms {
  return {
    effectiveFrom: fromDbDate(row.effectiveFrom),
    targetMinutes: {
      mon: row.targetMinutesMon,
      tue: row.targetMinutesTue,
      wed: row.targetMinutesWed,
      thu: row.targetMinutesThu,
      fri: row.targetMinutesFri,
      sat: row.targetMinutesSat,
      sun: row.targetMinutesSun,
    },
    minimumMinutes: {
      mon: row.minMinutesMon,
      tue: row.minMinutesTue,
      wed: row.minMinutesWed,
      thu: row.minMinutesThu,
      fri: row.minMinutesFri,
      sat: row.minMinutesSat,
      sun: row.minMinutesSun,
    },
    breakThresholdMinutes: row.breakThresholdMinutes,
    breakMinimumMinutes: row.breakMinimumMinutes,
    bandStartMinutes: dbTimeMinutes(row.bandStart),
    bandEndMinutes: dbTimeMinutes(row.bandEnd),
    paidOvertimeAllowed: row.paidOvertimeAllowed,
    toilMonthlyCapMinutes: row.toilMonthlyCapMinutes,
    conversionBlockMinutes: row.conversionBlockMinutes,
    leaveDayMaxMinutes: row.leaveDayMaxMinutes,
    flexiCreditCapMinutes: row.flexiCreditCapMinutes,
    flexiDebitCapMinutes: row.flexiDebitCapMinutes,
  };
}

export function toEngineDay(row: WorkDay): WorkDayRow {
  return {
    date: fromDbDate(row.date),
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    breakMinutes: row.breakMinutes,
    leaveMinutes: row.leaveMinutes,
    toilTakenMinutes: row.toilTakenMinutes,
    bankHolidayWorked: row.bankHolidayWorked,
  };
}

export const toEngineConversion = (row: ExcessConversion): string => fromDbDate(row.weekStart);

export const toEngineHoliday = (row: PublicHoliday): string => fromDbDate(row.date);

export function toEngineAdjustment(row: TimeAdjustment): EngineAdjustment {
  return {
    effectiveDate: fromDbDate(row.effectiveDate),
    balance: row.balance,
    minutes: row.minutes,
  };
}

export function toEngineLeaveYear(row: LeaveYear): LeaveYearSetting {
  return { year: row.year, allowanceMinutes: row.allowanceMinutes, boughtLeave: row.boughtLeave };
}
