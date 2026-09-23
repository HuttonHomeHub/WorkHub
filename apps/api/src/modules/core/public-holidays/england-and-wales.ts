/**
 * England and Wales bank holidays, bundled so an import never makes a network
 * call (docs/features/hours-tracker.md → Data model).
 *
 * - 2019–2028 are GOV.UK's published dates, copied verbatim from
 *   https://www.gov.uk/bank-holidays.json on 2026-09-23, one-off holidays
 *   included (2022's jubilee and state funeral, 2023's coronation).
 * - 2029–2040 are computed from the standing rules below. A one-off holiday
 *   declared for those years is added by hand; refresh the official list when
 *   GOV.UK publishes further years (docs/PROCESS.md → Maintenance).
 */
export interface BankHoliday {
  date: string;
  name: string;
}

const OFFICIAL: readonly (readonly [date: string, name: string])[] = [
  ['2019-01-01', "New Year's Day"],
  ['2019-04-19', 'Good Friday'],
  ['2019-04-22', 'Easter Monday'],
  ['2019-05-06', 'Early May bank holiday'],
  ['2019-05-27', 'Spring bank holiday'],
  ['2019-08-26', 'Summer bank holiday'],
  ['2019-12-25', 'Christmas Day'],
  ['2019-12-26', 'Boxing Day'],
  ['2020-01-01', "New Year's Day"],
  ['2020-04-10', 'Good Friday'],
  ['2020-04-13', 'Easter Monday'],
  ['2020-05-08', 'Early May bank holiday (VE day)'],
  ['2020-05-25', 'Spring bank holiday'],
  ['2020-08-31', 'Summer bank holiday'],
  ['2020-12-25', 'Christmas Day'],
  ['2020-12-28', 'Boxing Day'],
  ['2021-01-01', "New Year's Day"],
  ['2021-04-02', 'Good Friday'],
  ['2021-04-05', 'Easter Monday'],
  ['2021-05-03', 'Early May bank holiday'],
  ['2021-05-31', 'Spring bank holiday'],
  ['2021-08-30', 'Summer bank holiday'],
  ['2021-12-27', 'Christmas Day'],
  ['2021-12-28', 'Boxing Day'],
  ['2022-01-03', "New Year's Day"],
  ['2022-04-15', 'Good Friday'],
  ['2022-04-18', 'Easter Monday'],
  ['2022-05-02', 'Early May bank holiday'],
  ['2022-06-02', 'Spring bank holiday'],
  ['2022-06-03', 'Platinum Jubilee bank holiday'],
  ['2022-08-29', 'Summer bank holiday'],
  ['2022-09-19', 'Bank Holiday for the State Funeral of Queen Elizabeth II'],
  ['2022-12-26', 'Boxing Day'],
  ['2022-12-27', 'Christmas Day'],
  ['2023-01-02', "New Year's Day"],
  ['2023-04-07', 'Good Friday'],
  ['2023-04-10', 'Easter Monday'],
  ['2023-05-01', 'Early May bank holiday'],
  ['2023-05-08', 'Bank holiday for the coronation of King Charles III'],
  ['2023-05-29', 'Spring bank holiday'],
  ['2023-08-28', 'Summer bank holiday'],
  ['2023-12-25', 'Christmas Day'],
  ['2023-12-26', 'Boxing Day'],
  ['2024-01-01', "New Year's Day"],
  ['2024-03-29', 'Good Friday'],
  ['2024-04-01', 'Easter Monday'],
  ['2024-05-06', 'Early May bank holiday'],
  ['2024-05-27', 'Spring bank holiday'],
  ['2024-08-26', 'Summer bank holiday'],
  ['2024-12-25', 'Christmas Day'],
  ['2024-12-26', 'Boxing Day'],
  ['2025-01-01', "New Year's Day"],
  ['2025-04-18', 'Good Friday'],
  ['2025-04-21', 'Easter Monday'],
  ['2025-05-05', 'Early May bank holiday'],
  ['2025-05-26', 'Spring bank holiday'],
  ['2025-08-25', 'Summer bank holiday'],
  ['2025-12-25', 'Christmas Day'],
  ['2025-12-26', 'Boxing Day'],
  ['2026-01-01', "New Year's Day"],
  ['2026-04-03', 'Good Friday'],
  ['2026-04-06', 'Easter Monday'],
  ['2026-05-04', 'Early May bank holiday'],
  ['2026-05-25', 'Spring bank holiday'],
  ['2026-08-31', 'Summer bank holiday'],
  ['2026-12-25', 'Christmas Day'],
  ['2026-12-28', 'Boxing Day'],
  ['2027-01-01', "New Year's Day"],
  ['2027-03-26', 'Good Friday'],
  ['2027-03-29', 'Easter Monday'],
  ['2027-05-03', 'Early May bank holiday'],
  ['2027-05-31', 'Spring bank holiday'],
  ['2027-08-30', 'Summer bank holiday'],
  ['2027-12-27', 'Christmas Day'],
  ['2027-12-28', 'Boxing Day'],
  ['2028-01-03', "New Year's Day"],
  ['2028-04-14', 'Good Friday'],
  ['2028-04-17', 'Easter Monday'],
  ['2028-05-01', 'Early May bank holiday'],
  ['2028-05-29', 'Spring bank holiday'],
  ['2028-08-28', 'Summer bank holiday'],
  ['2028-12-25', 'Christmas Day'],
  ['2028-12-26', 'Boxing Day'],
];

export const OFFICIAL_LAST_YEAR = 2028;
/** The years `POST /public-holiday-imports` accepts. */
export const IMPORT_FIRST_YEAR = 2019;
export const IMPORT_LAST_YEAR = 2040;

const DAY_MS = 86_400_000;
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const utc = (year: number, month: number, day: number): number => Date.UTC(year, month - 1, day);
const weekday = (ms: number): number => new Date(ms).getUTCDay(); // 0 = Sunday

/** Easter Sunday (the anonymous Gregorian algorithm). */
function easterSunday(year: number): number {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

function firstMonday(year: number, month: number): number {
  const first = utc(year, month, 1);
  return first + ((8 - weekday(first)) % 7) * DAY_MS;
}

function lastMonday(year: number, month: number): number {
  const last = utc(year, month + 1, 0);
  return last - ((weekday(last) + 6) % 7) * DAY_MS;
}

const isWeekend = (ms: number): boolean => weekday(ms) === 0 || weekday(ms) === 6;

/**
 * Dates that fall on weekdays keep them; each weekend date moves to the next
 * weekday not already taken. So when Christmas is a Sunday, Boxing Day stays on
 * Monday 26 and Christmas moves to Tuesday 27, as GOV.UK lists 2022.
 */
function withSubstitutes(dates: number[]): number[] {
  const taken = new Set(dates.filter((ms) => !isWeekend(ms)));
  return dates.map((ms) => {
    if (!isWeekend(ms)) return ms;
    let day = ms;
    while (isWeekend(day) || taken.has(day)) day += DAY_MS;
    taken.add(day);
    return day;
  });
}

/**
 * The standing rules: New Year's Day, Good Friday, Easter Monday, the first and
 * last Mondays of May, the last Monday of August, Christmas Day and Boxing Day,
 * with weekend dates moved to the following weekdays.
 */
export function computedHolidays(year: number): BankHoliday[] {
  const easter = easterSunday(year);
  const [newYear] = withSubstitutes([utc(year, 1, 1)]) as [number];
  const [christmas, boxing] = withSubstitutes([utc(year, 12, 25), utc(year, 12, 26)]) as [
    number,
    number,
  ];
  const holidays = [
    { date: iso(newYear), name: "New Year's Day" },
    { date: iso(easter - 2 * DAY_MS), name: 'Good Friday' },
    { date: iso(easter + DAY_MS), name: 'Easter Monday' },
    { date: iso(firstMonday(year, 5)), name: 'Early May bank holiday' },
    { date: iso(lastMonday(year, 5)), name: 'Spring bank holiday' },
    { date: iso(lastMonday(year, 8)), name: 'Summer bank holiday' },
    { date: iso(christmas), name: 'Christmas Day' },
    { date: iso(boxing), name: 'Boxing Day' },
  ];
  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/** England and Wales bank holidays for a year in the import range, in date order. */
export function englandAndWalesHolidays(year: number): BankHoliday[] {
  if (year < IMPORT_FIRST_YEAR || year > IMPORT_LAST_YEAR) {
    throw new RangeError(`No bundled bank holidays for ${year}`);
  }
  if (year > OFFICIAL_LAST_YEAR) return computedHolidays(year);
  return OFFICIAL.filter(([date]) => date.startsWith(`${year}-`)).map(([date, name]) => ({
    date,
    name,
  }));
}
