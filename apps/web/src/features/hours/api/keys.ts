import type { components } from '@repo/types';

/** Query keys for the hours tool (docs/FRONTEND_ARCHITECTURE.md → Data fetching). */
export const hoursKeys = {
  all: ['hours'] as const,
  workTerms: () => [...hoursKeys.all, 'work-terms'] as const,
  leaveYears: () => [...hoursKeys.all, 'leave-years'] as const,
  timeAdjustments: () => [...hoursKeys.all, 'time-adjustments'] as const,
  /** Computed read-models: every hours or holiday change can move them. */
  computed: () => [...hoursKeys.all, 'computed'] as const,
  balances: (asOf: string) => [...hoursKeys.computed(), 'balances', asOf] as const,
  summaries: (query: TimeSummariesQuery) => [...hoursKeys.computed(), 'summaries', query] as const,
  excessConversions: () => [...hoursKeys.all, 'excess-conversions'] as const,
  excessConversionList: (range: { from: string; to: string }) =>
    [...hoursKeys.excessConversions(), range] as const,
};

/** `GET /time-summaries`: `to` is exclusive; `asOf` is today in Europe/London. */
export interface TimeSummariesQuery {
  from: string;
  to: string;
  groupBy: 'day' | 'week' | 'month';
  asOf: string;
}

export type WorkTerm = components['schemas']['WorkTermResponseDto'];
export type WorkTermInput = components['schemas']['CreateWorkTermDto'];
export type WorkTermUpdate = components['schemas']['UpdateWorkTermDto'];
export type LeaveYear = components['schemas']['LeaveYearResponseDto'];
export type LeaveYearInput = components['schemas']['CreateLeaveYearDto'];
export type TimeAdjustment = components['schemas']['TimeAdjustmentResponseDto'];
export type TimeAdjustmentInput = components['schemas']['CreateTimeAdjustmentDto'];
export type TimeBalances = components['schemas']['TimeBalancesDto'];
export type SummaryGroup = components['schemas']['SummaryGroupDto'];
export type HoursWarning = components['schemas']['HoursWarningDto'];
export type ExcessConversion = components['schemas']['ExcessConversionResponseDto'];
