import { londonDateAt, yearOf } from '@repo/domain';
import { HOURS_YEAR_MAX, HOURS_YEAR_MIN } from '@repo/types';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { HoursSettings, type SettingsTab } from '@/features/hours';

/**
 * The tabs the URL may name. Listed here rather than imported, because
 * `validateSearch` stays in the initial route tree: a value import from the
 * feature would pull the whole settings screen into the initial bundle (only
 * the component is code-split). `satisfies` keeps it in step with the screen's
 * tabs: a missing or extra tab is a type error.
 */
const TABS = {
  terms: 'terms',
  leave: 'leave',
  balances: 'balances',
  holidays: 'holidays',
} as const satisfies { [Tab in SettingsTab]: Tab };

/**
 * `/hours/settings?tab=terms|leave|balances|holidays&year=YYYY` (feature doc →
 * Routes and URL state). An unknown tab or year falls back to the default
 * rather than failing, so an old bookmark still opens the page.
 */
const searchSchema = z.object({
  tab: z.enum(TABS).optional().catch(undefined),
  /** The year the holidays tab shows; this year in London when absent. */
  year: z.coerce.number().int().min(HOURS_YEAR_MIN).max(HOURS_YEAR_MAX).optional().catch(undefined),
});

export const Route = createFileRoute('/_authed/hours/settings')({
  validateSearch: searchSchema,
  component: HoursSettingsPage,
});

function HoursSettingsPage() {
  const { tab = 'terms', year } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <HoursSettings
      tab={tab}
      onTabChange={(next) => void navigate({ search: (prev) => ({ ...prev, tab: next }) })}
      year={year ?? yearOf(londonDateAt(new Date()))}
      onYearChange={(next) => void navigate({ search: (prev) => ({ ...prev, year: next }) })}
    />
  );
}
