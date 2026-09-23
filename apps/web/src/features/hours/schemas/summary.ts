import { daysBetween } from '@repo/domain';
import { z } from 'zod';

import { SUMMARY_MAX_DAYS } from '../summary-range';

import { hoursDate } from './fields';

/**
 * The summary's custom range (ADR-0007): two inclusive dates, the end on or
 * after the start, at most 366 days in all (the API's limit), so a range the
 * API would refuse is never sent.
 */
export const summaryRangeFormSchema = z
  .object({ from: hoursDate, to: hoursDate })
  .superRefine((range, ctx) => {
    const days = daysBetween(range.from, range.to) + 1;
    if (days < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'Choose an end date on or after the start date.',
      });
    } else if (days > SUMMARY_MAX_DAYS) {
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `Choose a range of ${String(SUMMARY_MAX_DAYS)} days or fewer.`,
      });
    }
  });

export type SummaryRangeFormValues = z.input<typeof summaryRangeFormSchema>;
