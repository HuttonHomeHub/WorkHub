import type { WarningCode } from '@repo/domain';

/**
 * The engine's warning codes in en-GB copy (rule 13; feature doc → UI). A
 * warning never changes a number and never blocks anything; `BREAK_RAISED`
 * is a note rather than a warning.
 */
export const WARNING_LABELS: Record<WarningCode, string> = {
  BELOW_MINIMUM: 'Below minimum',
  OUTSIDE_BAND: 'Outside working band',
  MISSING_DAY: 'Day not recorded',
  FLEXI_CREDIT_CAP: 'Flexi over credit cap',
  FLEXI_DEBIT_CAP: 'Flexi over debit cap',
  TOIL_UNUSED: 'TOIL unused at month end',
  TOIL_NOT_EARNED: 'TOIL taken but not earned',
  LEAVE_OVER_ALLOWANCE: 'Leave over allowance',
  BREAK_RAISED: 'Break raised to minimum',
  INVALID_SPAN: 'Times not valid',
  TIME_OFF_OVER_TARGET: 'Time off over target',
};

/** Notes rather than warnings: shown, but in a quieter style. */
const NOTES: ReadonlySet<WarningCode> = new Set<WarningCode>(['BREAK_RAISED']);

export interface WarningCount {
  code: WarningCode;
  /** "Below minimum", or "Below minimum (2)" when it happened more than once. */
  label: string;
  count: number;
  note: boolean;
}

/**
 * A group's warnings as one entry per code, in the order they first appear,
 * with how many times each happened.
 */
export function countWarnings(warnings: readonly { code: WarningCode }[]): WarningCount[] {
  const counts = new Map<WarningCode, number>();
  for (const { code } of warnings) counts.set(code, (counts.get(code) ?? 0) + 1);
  return [...counts].map(([code, count]) => ({
    code,
    count,
    note: NOTES.has(code),
    label: count > 1 ? `${WARNING_LABELS[code]} (${String(count)})` : WARNING_LABELS[code],
  }));
}
