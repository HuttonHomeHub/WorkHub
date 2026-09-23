import {
  addDays,
  datesInRange,
  type IsoDate,
  isIsoDate,
  lastDayOfMonth,
  localDateOf,
  localMinutesOf,
  maxDate,
  minutesBetween,
  monthOf,
  weekStartOf,
  yearOf,
} from '../core/time/index.js';

import { checkSpan, sortTerms, termsFor, weekdayKey, workedTime } from './day.js';
import { BOUGHT_LEAVE_MINUTES, DEFAULT_LEAVE_ALLOWANCE_MINUTES } from './defaults.js';
import { levelExcess } from './levelling.js';
import type {
  ConversionState,
  DayResult,
  HoursInput,
  HoursResult,
  HoursWarning,
  LeaveYearResult,
  MonthResult,
  WeekResult,
  WorkDayRow,
  WorkTerms,
} from './types.js';

/** The years the engine accepts, as the API and the database do. */
export const ENGINE_YEAR_MIN = 2000;
export const ENGINE_YEAR_MAX = 2100;

/**
 * Input the engine cannot calculate: a date outside 2000–2100 or not a real
 * `YYYY-MM-DD`. Callers validate first (the API's DTOs do), so this is a
 * guard that bounds the work, never a message for the owner.
 */
export class HoursInputError extends Error {
  constructor(readonly field: string) {
    super(`Hours input out of range: ${field}`);
    this.name = 'HoursInputError';
  }
}

function assertDate(date: IsoDate, field: string): void {
  if (!isIsoDate(date)) throw new HoursInputError(field);
  const year = yearOf(date);
  if (year < ENGINE_YEAR_MIN || year > ENGINE_YEAR_MAX) throw new HoursInputError(field);
}

export interface CalculateOptions {
  /**
   * Compute at least through this date. The engine always covers whole weeks,
   * whole months and the whole leave year of `max(asOf, until)`.
   */
  until?: IsoDate;
}

/**
 * The hours engine (docs/features/hours-tracker.md → Calculation rules 1–14).
 * Pure and deterministic: every figure is recomputed from the rows, from the
 * tracking start, so the same input always gives the same result. At personal
 * scale (under 400 rows a year) this is milliseconds.
 */
export function calculateHours(input: HoursInput, options: CalculateOptions = {}): HoursResult {
  const { asOf } = input;
  // Bound the work: dates outside 2000–2100 would make the range unbounded
  // (and the fast date helpers are only correct for four-digit years).
  assertDate(asOf, 'asOf');
  if (options.until !== undefined) assertDate(options.until, 'until');
  input.terms.forEach((t, i) => assertDate(t.effectiveFrom, `terms[${i}].effectiveFrom`));
  input.days.forEach((d, i) => assertDate(d.date, `days[${i}].date`));
  input.conversions.forEach((d, i) => assertDate(d, `conversions[${i}]`));
  input.publicHolidays.forEach((d, i) => assertDate(d, `publicHolidays[${i}]`));
  input.adjustments.forEach((a, i) =>
    assertDate(a.effectiveDate, `adjustments[${i}].effectiveDate`),
  );
  const terms = sortTerms(input.terms);
  const trackingStart = terms[0]?.effectiveFrom ?? null;
  if (trackingStart === null) {
    return { asOf, trackingStart, days: [], weeks: [], months: [], leaveYears: [] };
  }

  const horizon = maxDate(asOf, options.until ?? asOf);
  const lastDate = maxDate(`${yearOf(horizon)}-12-31`, lastDayOfMonth(horizon));
  const end = addDays(weekStartOf(lastDate), 7); // exclusive: the Monday after
  const dates = datesInRange(trackingStart, end);

  const rows = new Map<IsoDate, WorkDayRow>(input.days.map((row) => [row.date, row]));
  const holidays = new Set(input.publicHolidays);
  const conversions = new Set(input.conversions);
  const termsOn = (date: IsoDate): WorkTerms => termsFor(terms, date) ?? (terms[0] as WorkTerms);

  // Adjustments before the tracking start take effect on it.
  const adjustments = (balance: 'FLEXI' | 'TOIL' | 'LEAVE') => {
    const byDate = new Map<IsoDate, number>();
    for (const adj of input.adjustments) {
      if (adj.balance !== balance) continue;
      const date = maxDate(adj.effectiveDate, trackingStart);
      byDate.set(date, (byDate.get(date) ?? 0) + adj.minutes);
    }
    return byDate;
  };
  const flexiAdjustments = adjustments('FLEXI');
  const toilAdjustments = adjustments('TOIL');
  const leaveAdjustments = adjustments('LEAVE');

  // --- Days: rules 1, 3, 4, 5 and the per-day warnings of rule 13 ----------
  const days = dates.map((date) => computeDay(date, termsOn(date), rows.get(date), holidays, asOf));
  const byDate = new Map(days.map((day) => [day.date, day]));

  // --- Weeks: rule 6 --------------------------------------------------------
  const weeks: WeekResult[] = [];
  for (let i = 0; i < days.length; i += 7) {
    const weekDays = days.slice(i, i + 7);
    const weekStart = weekDays[0]!.date;
    const working = weekDays.filter((day) => day.working);
    const settlementDate = working.at(-1)?.date ?? null;
    const excessMinutes = Math.max(
      0,
      weekDays.filter((day) => day.counted).reduce((sum, day) => sum + day.rawFlexiMinutes, 0),
    );
    let conversion: ConversionState = 'OFF';
    if (conversions.has(weekStart)) {
      conversion = settlementDate !== null && asOf >= settlementDate ? 'APPLIED' : 'PREVIEW';
    }
    // Only worked minutes can be converted. Crediting time off at most the
    // target (rule 4, in computeDay) keeps E within them; the clamp is a
    // guard so the calculation can never fail.
    const counted = weekDays.filter((day) => day.counted);
    const convertible = Math.min(
      excessMinutes,
      counted.reduce((sum, day) => sum + day.workedMinutes, 0),
    );
    const allocation =
      conversion !== 'OFF' && convertible > 0 ? levelExcess(convertible, counted) : {};
    for (const [date, minutes] of Object.entries(allocation)) {
      const day = byDate.get(date)!;
      if (conversion === 'APPLIED') {
        day.convertedMinutes = minutes;
        day.dayFlexiMinutes = day.rawFlexiMinutes - minutes;
      } else {
        day.previewConvertedMinutes = minutes;
      }
    }
    weeks.push({
      weekStart,
      settlementDate,
      conversion,
      excessMinutes,
      allocation,
      toilMinutes: 0,
      overtimePaidMinutes: 0,
      overtimeUnpaidMinutes: 0,
    });
  }
  const weekOf = new Map(weeks.map((week) => [week.weekStart, week]));

  // --- Months: rules 7, 8 and 9 --------------------------------------------
  const addOvertime = (day: DayResult, minutes: number, target?: WeekResult) => {
    if (minutes <= 0) return;
    const paid = termsOn(day.date).paidOvertimeAllowed;
    if (paid) day.overtimePaidMinutes += minutes;
    else day.overtimeUnpaidMinutes += minutes;
    if (target) {
      if (paid) target.overtimePaidMinutes += minutes;
      else target.overtimeUnpaidMinutes += minutes;
    }
  };

  const months: MonthResult[] = [];
  let monthDays: DayResult[] = [];
  const closeMonth = () => {
    const first = monthDays[0];
    if (!first) return;
    const last = monthDays.at(-1)!;
    const month = monthOf(first.date);
    const monthEnd = lastDayOfMonth(first.date);
    const ended = asOf > monthEnd;
    const cap = termsOn(monthEnd).toilMonthlyCapMinutes;

    // Rule 7: walk the month in date order; converted minutes are TOIL until the
    // month's TOIL reaches the cap, and overtime beyond it. Adjustments count
    // towards the cap but never overflow. Previews walk after applied minutes.
    let toil = 0;
    let previewToil = 0;
    for (const day of monthDays) {
      toil += toilAdjustments.get(day.date) ?? 0;
      const dayCap = termsOn(day.date).toilMonthlyCapMinutes;
      const room = Math.max(0, dayCap - toil);
      day.toilMinutes = Math.min(day.convertedMinutes, room);
      toil += day.toilMinutes;
      const week = weekOf.get(weekStartOf(day.date))!;
      if (day.convertedMinutes > 0) {
        week.toilMinutes += day.toilMinutes;
        addOvertime(day, day.convertedMinutes - day.toilMinutes, week);
      }
    }
    // Previews change no balance; their split is the week's preview figures.
    // A preview day in a month that ends before its week settles becomes
    // overtime then (rule 8), so it previews as overtime.
    for (const day of monthDays) {
      if (day.previewConvertedMinutes === 0) continue;
      const week = weekOf.get(weekStartOf(day.date))!;
      const monthEndsFirst = week.settlementDate !== null && monthEnd < week.settlementDate;
      const room = monthEndsFirst
        ? 0
        : Math.max(0, termsOn(day.date).toilMonthlyCapMinutes - toil - previewToil);
      const toilPart = Math.min(day.previewConvertedMinutes, room);
      previewToil += toilPart;
      week.toilMinutes += toilPart;
      const over = day.previewConvertedMinutes - toilPart;
      if (over > 0) {
        const overDate = monthEndsFirst ? monthEnd : day.date;
        if (termsOn(overDate).paidOvertimeAllowed) week.overtimePaidMinutes += over;
        else week.overtimeUnpaidMinutes += over;
      }
    }

    // Rule 8: once the month has ended, unused TOIL becomes overtime on its last
    // day; TOIL taken but not earned becomes a flexi debit there.
    const taken = monthDays.reduce((sum, day) => sum + day.toilTakenMinutes, 0);
    let unused = 0;
    let debit = 0;
    if (ended) {
      const lastDay = byDate.get(monthEnd) ?? last;
      const balance = toil - taken;
      if (balance > 0) {
        unused = balance;
        lastDay.toilUnusedMinutes = balance;
        addOvertime(lastDay, balance);
        lastDay.warnings.push({ code: 'TOIL_UNUSED', date: lastDay.date });
      } else if (balance < 0) {
        debit = -balance;
        lastDay.flexiDebitMinutes = debit;
        lastDay.warnings.push({ code: 'TOIL_NOT_EARNED', date: lastDay.date });
      }
    }
    months.push({
      month,
      ended,
      toilCapMinutes: cap,
      toilMinutes: toil,
      toilTakenMinutes: taken,
      toilUnusedMinutes: unused,
      flexiDebitMinutes: debit,
    });
    monthDays = [];
  };
  for (const day of days) {
    if (monthDays[0] && monthOf(monthDays[0].date) !== monthOf(day.date)) closeMonth();
    monthDays.push(day);
  }
  closeMonth();

  // --- Flexi balance: rule 10 ----------------------------------------------
  let balance = 0;
  for (const day of days) {
    const before = balance;
    balance += day.dayFlexiMinutes - day.flexiDebitMinutes + (flexiAdjustments.get(day.date) ?? 0);
    day.flexiBalanceMinutes = balance;
    const { flexiCreditCapMinutes: credit, flexiDebitCapMinutes: debitCap } = termsOn(day.date);
    if (credit !== null && balance > credit && before <= credit) {
      day.warnings.push({ code: 'FLEXI_CREDIT_CAP', date: day.date });
    }
    if (debitCap !== null && balance < -debitCap && before >= -debitCap) {
      day.warnings.push({ code: 'FLEXI_DEBIT_CAP', date: day.date });
    }
  }

  // --- Leave years: rule 12 ------------------------------------------------
  // Leave counts when booked, so future leave and bank holidays in the year are
  // included. A LEAVE adjustment adds to what remains (negative for leave used
  // before tracking started).
  const leaveYears: LeaveYearResult[] = [];
  const settings = new Map(input.leaveYears.map((setting) => [setting.year, setting]));
  let current: (LeaveYearResult & { warned: boolean }) | undefined;
  const closeYear = () => {
    if (!current) return;
    const { warned: _warned, ...year } = current;
    leaveYears.push({ ...year, remainingMinutes: year.allowanceMinutes - year.usedMinutes });
  };
  for (const day of days) {
    const year = yearOf(day.date);
    if (current?.year !== year) {
      closeYear();
      const setting = settings.get(year);
      current = {
        year,
        allowanceMinutes:
          (setting?.allowanceMinutes ?? DEFAULT_LEAVE_ALLOWANCE_MINUTES) +
          (setting?.boughtLeave ? BOUGHT_LEAVE_MINUTES : 0),
        usedMinutes: 0,
        remainingMinutes: 0,
        warned: false,
      };
    }
    current.allowanceMinutes += leaveAdjustments.get(day.date) ?? 0;
    current.usedMinutes += day.leaveMinutes + day.bankHolidayMinutes;
    if (!current.warned && current.usedMinutes > current.allowanceMinutes) {
      current.warned = true;
      day.warnings.push({ code: 'LEAVE_OVER_ALLOWANCE', date: day.date });
    }
  }
  closeYear();

  return { asOf, trackingStart, days, weeks, months, leaveYears };
}

/** One date's figures before conversions and month-end effects. */
function computeDay(
  date: IsoDate,
  terms: WorkTerms,
  row: WorkDayRow | undefined,
  holidays: ReadonlySet<IsoDate>,
  asOf: IsoDate,
): DayResult {
  const key = weekdayKey(date);
  const target = terms.targetMinutes[key];
  const working = target !== null;
  const targetMinutes = target ?? 0;
  const minimumMinutes = working ? terms.minimumMinutes[key] : null;
  const counted = date < asOf || (date === asOf && row !== undefined);
  const warnings: HoursWarning[] = [];

  let spanMinutes = 0;
  let breakDeductedMinutes = 0;
  let workedMinutes = 0;
  if (row?.startsAt && row.endsAt) {
    if (checkSpan(row.startsAt, row.endsAt) === null) {
      const worked = workedTime(minutesBetween(row.startsAt, row.endsAt), row.breakMinutes, terms);
      ({ spanMinutes, breakDeductedMinutes, workedMinutes } = worked);
      if (worked.breakRaised) warnings.push({ code: 'BREAK_RAISED', date });
      const endsLater = localDateOf(row.endsAt) > date;
      if (
        localMinutesOf(row.startsAt) < terms.bandStartMinutes ||
        endsLater ||
        localMinutesOf(row.endsAt) > terms.bandEndMinutes
      ) {
        warnings.push({ code: 'OUTSIDE_BAND', date });
      }
    } else {
      warnings.push({ code: 'INVALID_SPAN', date });
    }
  }

  // Rule 4: bank holiday credit on a working day, unless it was worked.
  const bankHoliday = working && holidays.has(date);
  const bankHolidayMinutes =
    bankHoliday && !row?.bankHolidayWorked ? Math.min(terms.leaveDayMaxMinutes, targetMinutes) : 0;
  const leaveMinutes = row?.leaveMinutes ?? 0;
  const toilTakenMinutes = row?.toilTakenMinutes ?? 0;
  // Rule 4: time off never creates excess, so it credits at most the target
  // (nothing on a non-working day). The API enforces this on save; rows can
  // break it after a later terms change, and then warn TIME_OFF_OVER_TARGET.
  // The recorded leave still counts against the allowance (rule 12).
  const timeOffMinutes = leaveMinutes + toilTakenMinutes + bankHolidayMinutes;
  const creditedMinutes = workedMinutes + Math.min(timeOffMinutes, targetMinutes);
  const rawFlexiMinutes = counted ? creditedMinutes - targetMinutes : 0;

  if (counted && row && minimumMinutes !== null && creditedMinutes < minimumMinutes) {
    warnings.push({ code: 'BELOW_MINIMUM', date });
  }
  if (timeOffMinutes > targetMinutes) {
    warnings.push({ code: 'TIME_OFF_OVER_TARGET', date });
  }
  if (working && date < asOf && !row && !bankHoliday) {
    warnings.push({ code: 'MISSING_DAY', date });
  }

  return {
    date,
    tracked: true,
    working,
    targetMinutes,
    minimumMinutes,
    hasRow: row !== undefined,
    counted,
    spanMinutes,
    breakRecordedMinutes: row?.breakMinutes ?? 0,
    breakDeductedMinutes,
    workedMinutes,
    leaveMinutes,
    toilTakenMinutes,
    bankHoliday,
    bankHolidayMinutes,
    creditedMinutes,
    rawFlexiMinutes,
    convertedMinutes: 0,
    dayFlexiMinutes: rawFlexiMinutes,
    flexiDebitMinutes: 0,
    toilMinutes: 0,
    toilUnusedMinutes: 0,
    overtimePaidMinutes: 0,
    overtimeUnpaidMinutes: 0,
    flexiBalanceMinutes: 0,
    previewConvertedMinutes: 0,
    warnings,
  };
}
