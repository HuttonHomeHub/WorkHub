import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { WeekView } from '@/features/hours';
import { todayInLondon } from '@/features/hours/week/week-dates';

/**
 * `/hours?week=YYYY-MM-DD`: the hours week view (feature doc → Routes and URL
 * state). The week is always a Monday in the URL, so reload, back and forward
 * and bookmarks restore it: another valid date is replaced by its Monday, and
 * a missing or unreadable one by this week's (in Europe/London).
 *
 * The normalising helpers load with `import()`, because everything here but
 * the component is in the initial bundle, and `@repo/domain` brings
 * `temporal-polyfill` (slice 5's measurement: a value import cost 45 kB).
 */
const searchSchema = z.object({
  week: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/_authed/hours/')({
  validateSearch: searchSchema,
  beforeLoad: async ({ search }) => {
    const { normaliseWeek, todayInLondon } = await import('@/features/hours/week/week-dates');
    const week = normaliseWeek(search.week, todayInLondon());
    if (week !== search.week) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- thrown redirects are the TanStack Router control-flow idiom
      throw redirect({ to: '/hours', search: { week }, replace: true });
    }
  },
  component: HoursWeekPage,
});

function HoursWeekPage() {
  const { week } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const today = todayInLondon();
  // `beforeLoad` has made `week` a Monday by the time this renders.
  return (
    <WeekView
      weekStart={week ?? today}
      today={today}
      onWeekChange={(next) => void navigate({ search: { week: next } })}
    />
  );
}
