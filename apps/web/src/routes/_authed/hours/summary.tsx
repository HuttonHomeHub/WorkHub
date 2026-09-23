import { londonDateAt } from '@repo/domain';
import { HOURS_YEAR_MAX, HOURS_YEAR_MIN } from '@repo/types';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import * as React from 'react';
import { z } from 'zod';

import { HoursSummary, type SummaryGroupBy } from '@/features/hours';

/**
 * The groupings the URL may name. Listed here rather than imported, because
 * `validateSearch` stays in the initial route tree (see settings.tsx);
 * `satisfies` keeps it in step with the feature's type.
 */
const GROUP_BY = { week: 'week', month: 'month' } as const satisfies {
  [Group in SummaryGroupBy]: Group;
};

/** A real `YYYY-MM-DD` date in the years hours can be calculated for. */
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      year >= HOURS_YEAR_MIN &&
      year <= HOURS_YEAR_MAX &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().startsWith(value)
    );
  });

/**
 * `/hours/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=week|month` (feature
 * doc → Routes and URL state). `from` and `to` are inclusive. A malformed
 * value falls back to the default (this month, by week) rather than failing,
 * so an old bookmark still opens the page.
 */
const searchSchema = z.object({
  from: date.optional().catch(undefined),
  to: date.optional().catch(undefined),
  groupBy: z.enum(GROUP_BY).optional().catch(undefined),
});

export const Route = createFileRoute('/_authed/hours/summary')({
  validateSearch: searchSchema,
  component: HoursSummaryPage,
});

function HoursSummaryPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [today] = React.useState(() => londonDateAt(new Date()));
  return (
    <HoursSummary
      search={search}
      today={today}
      onSearchChange={(next) => void navigate({ search: next })}
    />
  );
}
