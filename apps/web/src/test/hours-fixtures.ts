import type { SummaryGroup, TimeBalances } from '@/features/hours/api/keys';

/**
 * Fixtures for the hours screens' component tests: API response shapes with
 * the worked example's figures (feature doc → Worked example), overridable.
 */

/** The week of Mon 5 Oct 2026 with its conversion applied: 1:00 TOIL, 2:00 unpaid overtime. */
export function summaryGroup(overrides: Partial<SummaryGroup> = {}): SummaryGroup {
  return {
    key: '2026-10-05',
    start: '2026-10-05',
    end: '2026-10-12',
    targetMinutes: 2250,
    creditedMinutes: 2430,
    workedMinutes: 2430,
    leaveMinutes: 0,
    bankHolidayMinutes: 0,
    rawFlexiMinutes: 180,
    convertedMinutes: 180,
    flexiMinutes: 0,
    toilMinutes: 60,
    toilTakenMinutes: 0,
    toilUnusedMinutes: 0,
    overtimePaidMinutes: 0,
    overtimeUnpaidMinutes: 120,
    flexiBalanceEndMinutes: 192,
    conversion: 'APPLIED',
    settlementDate: '2026-10-09',
    excessMinutes: 180,
    conversionBlockMinutes: 30,
    conversionMinutes: 180,
    conversionToilMinutes: 60,
    conversionOvertimePaidMinutes: 0,
    conversionOvertimeUnpaidMinutes: 120,
    warnings: [],
    ...overrides,
  };
}

/** `GET /time-balances` for a date in October 2026. */
export function timeBalances(overrides: Partial<TimeBalances> = {}): TimeBalances {
  return {
    asOf: '2026-10-14',
    trackingStart: '2026-09-07',
    flexiMinutes: 192,
    toilMonthMinutes: 450,
    toilTakenMonthMinutes: 0,
    toilCapMinutes: 450,
    leaveAllowanceMinutes: 14_850,
    leaveUsedMinutes: 7_650,
    leaveRemainingMinutes: 7_200,
    overtimePaidYearMinutes: 0,
    overtimeUnpaidYearMinutes: 120,
    ...overrides,
  };
}
