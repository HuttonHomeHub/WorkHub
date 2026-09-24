import { defaultWorkTerms } from '@repo/domain';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SummaryGroup, WorkTerm } from '../api/keys';
import type { WorkDay } from '../api/work-days';

import type * as TimeInputModule from './time-input';
import { WeekAside } from './week-aside';
import { WeekOverview } from './week-overview';
import { WeekView } from './week-view';

/** How often each time field has rendered, by its id (for the memoised rows). */
const timeInputRenders = new Map<string, number>();

vi.mock('./time-input', async (importOriginal) => {
  const actual = await importOriginal<typeof TimeInputModule>();
  return {
    TimeInput: (props: React.ComponentProps<typeof TimeInputModule.TimeInput>) => {
      if (props.id) timeInputRenders.set(props.id, (timeInputRenders.get(props.id) ?? 0) + 1);
      return actual.TimeInput(props);
    },
  };
});

import { dismissToast } from '@/components/ui/toast';
import { on, page, renderWithApi, stubApi, type ApiCall } from '@/test/api-stub';
import { summaryGroup, timeBalances } from '@/test/hours-fixtures';

const WEEK = '2026-10-05';
/** Every day of the week is in the past. */
const TODAY = '2026-10-12';

function terms(effectiveFrom = '2026-09-07'): WorkTerm {
  const engine = defaultWorkTerms(effectiveFrom);
  return {
    id: 'terms-1',
    ownerId: 'owner',
    effectiveFrom,
    targetMinutes: engine.targetMinutes,
    minimumMinutes: engine.minimumMinutes,
    breakThresholdMinutes: 360,
    breakMinimumMinutes: 30,
    bandStart: '07:00',
    bandEnd: '19:00',
    paidOvertimeAllowed: false,
    toilMonthlyCapMinutes: 450,
    conversionBlockMinutes: 30,
    leaveDayMaxMinutes: 450,
    flexiCreditCapMinutes: null,
    flexiDebitCapMinutes: null,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function workDay(date: string, fields: Partial<WorkDay> = {}): WorkDay {
  return {
    id: `day-${date}`,
    ownerId: 'owner',
    date,
    startsAt: null,
    endsAt: null,
    breakMinutes: 0,
    leaveMinutes: 0,
    toilTakenMinutes: 0,
    bankHolidayWorked: false,
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...fields,
  };
}

interface Data {
  terms?: WorkTerm[];
  days?: WorkDay[];
  converting?: boolean;
  holidays?: string[];
}

/** The API the week view reads, with room for a test's own handlers first. */
function stubWeek(data: Data, ...handlers: Parameters<typeof stubApi>) {
  const state = {
    terms: data.terms ?? [terms()],
    days: data.days ?? [],
  };
  const api = stubApi(
    ...handlers,
    on('GET', '/api/v1/work-terms', () => page(state.terms)),
    on('GET', '/api/v1/work-days', () => page(state.days)),
    on('GET', '/api/v1/excess-conversions', () =>
      page(
        data.converting
          ? [{ id: 'switch-1', ownerId: 'owner', weekStart: WEEK, createdAt: WEEK }]
          : [],
      ),
    ),
    on('GET', '/api/v1/public-holidays', () =>
      page(
        (data.holidays ?? []).map((date) => ({
          id: `h-${date}`,
          ownerId: 'owner',
          date,
          name: 'Bank holiday',
          version: 1,
          createdAt: WEEK,
          updatedAt: WEEK,
        })),
      ),
    ),
  );
  return { ...api, state };
}

async function renderWeek({
  weekStart = WEEK,
  today = TODAY,
  withAside = false,
}: { weekStart?: string; today?: string; withAside?: boolean } = {}) {
  const onWeekChange = vi.fn();
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const hours = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <>
        <Link to="/hours/settings">Elsewhere</Link>
        <WeekView
          weekStart={weekStart}
          today={today}
          onWeekChange={onWeekChange}
          {...(withAside
            ? {
                aside: (context) => <WeekAside {...context} />,
                overview: (context) => <WeekOverview {...context} />,
              }
            : {})}
        />
      </>
    ),
  });
  const elsewhere = createRoute({
    getParentRoute: () => rootRoute,
    path: '/hours/settings',
    component: () => <h1>Elsewhere</h1>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([hours, elsewhere]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  renderWithApi(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Hours' });
  return { onWeekChange, router };
}

const field = (name: string, day: string) =>
  screen.getByRole('textbox', { name: `${name}, ${day}` });
const row = (day: string) => screen.getByRole('row', { name: new RegExp(`^${day}`) });
/** A day's warnings and notes: a row of its own under the day's row. */
const notes = (day: string) =>
  screen.getByRole('row', { name: new RegExp(`^(Warnings|Notes) for ${day}:`) });

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
});

afterEach(() => {
  act(() => dismissToast());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WeekView', () => {
  it('shows seven editable rows for an empty week, with the week in its heading', async () => {
    const { calls } = stubWeek({});
    await renderWeek();
    expect(await screen.findByText('No time recorded this week.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Week of 5 Oct 2026' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Week of 5 Oct 2026' });
    // Seven day rows (each weekday's warnings in a row under it), the head and the totals.
    expect(
      within(table).getAllByRole('row', { name: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/ }),
    ).toHaveLength(7);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(8);
    expect(field('Start', 'Mon 5 Oct')).toHaveValue('');
    expect(notes('Fri 9 Oct')).toHaveTextContent('Warning: Nothing recorded');
    const list = calls.find((call) => call.path === '/api/v1/work-days');
    expect(list?.search.get('from')).toBe(WEEK);
    expect(list?.search.get('to')).toBe('2026-10-12');
  });

  it('shows a day live as it is typed, and saves it with Enter', async () => {
    const user = userEvent.setup();
    const { calls, state } = stubWeek(
      {},
      on('POST', '/api/v1/work-days', (call: ApiCall) => {
        const saved = workDay(WEEK, call.body as Partial<WorkDay>);
        state.days = [saved];
        return { status: 201, body: { data: saved } };
      }),
    );
    await renderWeek();

    await user.type(await screen.findByRole('textbox', { name: 'Start, Mon 5 Oct' }), '0800');
    await user.tab();
    expect(field('Start', 'Mon 5 Oct')).toHaveValue('08:00');
    await user.type(field('End', 'Mon 5 Oct'), '1730');
    await user.type(field('Break', 'Mon 5 Oct'), '30m');
    // Live figures and the unsaved state, before anything is sent.
    expect(row('Mon 5 Oct')).toHaveTextContent('Unsaved');
    expect(row('Mon 5 Oct')).toHaveTextContent('9:00');
    expect(row('Mon 5 Oct')).toHaveTextContent('+1:30 over');
    expect(screen.getByRole('row', { name: /^Week/ })).toHaveTextContent('9:00 of 37:30 target');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    await user.keyboard('{Enter}');
    expect(await screen.findByText('Mon 5 Oct saved')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      date: WEEK,
      startsAt: '2026-10-05T07:00:00Z',
      endsAt: '2026-10-05T16:30:00Z',
      breakMinutes: 30,
      leaveMinutes: 0,
      toilTakenMinutes: 0,
      bankHolidayWorked: false,
    });
    await waitFor(() => expect(row('Mon 5 Oct')).not.toHaveTextContent('Unsaved'));
    expect(field('Break', 'Mon 5 Oct')).toHaveValue('0:30');
  });

  it('re-renders only the row being typed in', async () => {
    const user = userEvent.setup();
    stubWeek({
      days: [
        workDay('2026-10-06', {
          startsAt: '2026-10-06T07:00:00.000Z',
          endsAt: '2026-10-06T15:30:00.000Z',
        }),
      ],
    });
    await renderWeek();
    const start = await screen.findByRole('textbox', { name: 'Start, Mon 5 Oct' });
    const before = new Map(timeInputRenders);
    await user.type(start, '0800');
    await user.type(field('End', 'Mon 5 Oct'), '1730');
    // The typed row renders on each key; the others (and their live figures) stay put.
    expect(timeInputRenders.get('hours-start-2026-10-05')).toBeGreaterThan(
      before.get('hours-start-2026-10-05') ?? 0,
    );
    for (const date of ['2026-10-06', '2026-10-07', '2026-10-11']) {
      expect(timeInputRenders.get(`hours-start-${date}`)).toBe(before.get(`hours-start-${date}`));
    }
    expect(screen.getByRole('row', { name: /^Week/ })).toHaveTextContent('17:00 of 37:30 target');
  });

  it("keeps the browser's own menu on a row with no actions", async () => {
    stubWeek({
      days: [
        workDay('2026-10-06', {
          startsAt: '2026-10-06T07:00:00.000Z',
          endsAt: '2026-10-06T15:30:00.000Z',
        }),
      ],
    });
    await renderWeek();
    await screen.findByRole('textbox', { name: 'Start, Mon 5 Oct' });
    // Nothing on Monday: the event is left alone (not cancelled), and no menu opens.
    expect(fireEvent.contextMenu(row('Mon 5 Oct'))).toBe(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    // Tuesday has a saved day, so its row opens the row menu instead.
    expect(fireEvent.contextMenu(row('Tue 6 Oct'))).toBe(false);
    expect(await screen.findByRole('menuitem', { name: 'Clear day' })).toBeInTheDocument();
  });

  it('shows an end before the start as the next day, announced', async () => {
    const user = userEvent.setup();
    stubWeek({});
    await renderWeek();
    await user.type(await screen.findByRole('textbox', { name: 'Start, Wed 7 Oct' }), '2200');
    await user.type(field('End', 'Wed 7 Oct'), '0600');
    const end = field('End', 'Wed 7 Oct');
    expect(end).toHaveAccessibleDescription(expect.stringContaining('+1 day'));
    // Read with the field, never announced by itself: a partial time would
    // make it come and go while typing.
    expect(screen.getByText('+1 day').closest('[aria-live]')).toBeNull();
    expect(row('Wed 7 Oct')).toHaveTextContent('7:30');
    expect(notes('Wed 7 Oct')).toHaveTextContent('After 19:00');
  });

  it('reverts a row with Esc', async () => {
    const user = userEvent.setup();
    stubWeek({
      days: [
        workDay(WEEK, { startsAt: '2026-10-05T07:00:00.000Z', endsAt: '2026-10-05T16:30:00.000Z' }),
      ],
    });
    await renderWeek();
    const start = await screen.findByRole('textbox', { name: 'Start, Mon 5 Oct' });
    expect(start).toHaveValue('08:00');
    await user.clear(start);
    await user.type(start, '0930');
    expect(row('Mon 5 Oct')).toHaveTextContent('Unsaved');
    await user.keyboard('{Escape}');
    expect(start).toHaveValue('08:00');
    expect(row('Mon 5 Oct')).not.toHaveTextContent('Unsaved');
  });

  it('validates a field when it is left, and every field on save', async () => {
    const user = userEvent.setup();
    const { calls } = stubWeek({});
    await renderWeek();
    const start = await screen.findByRole('textbox', { name: 'Start, Tue 6 Oct' });
    await user.type(start, '25');
    // Nothing while typing.
    expect(screen.queryByText('Enter a 24-hour time, such as 08:30.')).not.toBeInTheDocument();
    await user.tab();
    expect(start).toHaveAccessibleDescription(
      expect.stringContaining('Enter a 24-hour time, such as 08:30.'),
    );
    expect(start).toHaveAttribute('aria-invalid', 'true');

    await user.clear(start);
    await user.type(start, '0800{Enter}');
    // The end was never visited: saving flags it and moves focus there.
    expect(await screen.findByText('Enter an end time too.')).toBeInTheDocument();
    expect(field('End', 'Tue 6 Oct')).toHaveFocus();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('updates a saved day with its version, and shows a refusal under the row', async () => {
    const user = userEvent.setup();
    const saved = workDay('2026-10-08', { leaveMinutes: 60, version: 4 });
    const { calls } = stubWeek(
      { days: [saved] },
      on('PATCH', `/api/v1/work-days/${saved.id}`, () => ({
        status: 422,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The day is not valid.',
            details: ['leave must be at most 7:30'],
          },
        },
      })),
    );
    await renderWeek();
    const leave = await screen.findByRole('textbox', { name: 'Leave, Thu 8 Oct' });
    expect(leave).toHaveValue('1:00');
    await user.clear(leave);
    await user.type(leave, '8h{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't save Thu 8 Oct.");
    expect(alert).toHaveTextContent('leave must be at most 7:30');
    expect(leave).toHaveAccessibleDescription(
      expect.stringContaining('leave must be at most 7:30'),
    );
    // The owner's input stays.
    expect(leave).toHaveValue('8h');
    expect(calls.find((call) => call.method === 'PATCH')?.body).toMatchObject({
      leaveMinutes: 480,
      version: 4,
    });
  });

  it('offers to reload when the day changed elsewhere', async () => {
    const user = userEvent.setup();
    const saved = workDay('2026-10-08', { leaveMinutes: 60 });
    stubWeek(
      { days: [saved] },
      on('PATCH', `/api/v1/work-days/${saved.id}`, () => ({
        status: 409,
        body: { error: { code: 'CONFLICT', message: 'Stale.' } },
      })),
    );
    await renderWeek();
    const leave = await screen.findByRole('textbox', { name: 'Leave, Thu 8 Oct' });
    await user.clear(leave);
    await user.type(leave, '2h{Enter}');
    expect(await screen.findByText("We couldn't save Thu 8 Oct")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(leave).toHaveValue('1:00'));
  });

  it('clears a day from its menu, moves focus to the next row, and undoes it', async () => {
    const user = userEvent.setup();
    const saved = workDay('2026-10-06', {
      startsAt: '2026-10-06T07:00:00.000Z',
      endsAt: '2026-10-06T15:30:00.000Z',
    });
    const { state } = stubWeek(
      { days: [saved] },
      on('DELETE', `/api/v1/work-days/${saved.id}`, () => {
        state.days = [];
        return { status: 204 };
      }),
      on('POST', `/api/v1/work-days/${saved.id}/restore`, () => {
        state.days = [saved];
        return { status: 200, body: { data: saved } };
      }),
    );
    await renderWeek();
    await user.click(await screen.findByRole('button', { name: 'Actions for Tue 6 Oct' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Clear day' }));

    expect(await screen.findByText('Day cleared')).toBeInTheDocument();
    await waitFor(() => expect(field('Start', 'Wed 7 Oct')).toHaveFocus());
    await waitFor(() => expect(field('Start', 'Tue 6 Oct')).toHaveValue(''));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Tue 6 Oct restored')).toBeInTheDocument();
    await waitFor(() => expect(field('Start', 'Tue 6 Oct')).toHaveValue('08:00'));
  });

  it('credits a bank holiday, and marks it as worked from the menu', async () => {
    const user = userEvent.setup();
    stubWeek({ holidays: ['2026-10-05'] });
    await renderWeek();
    expect(await screen.findByText('Bank holiday · 7:30 credited')).toBeInTheDocument();
    expect(row('Mon 5 Oct')).toHaveTextContent('0:00');
    // Only a bank holiday offers it.
    await user.click(screen.getByRole('button', { name: 'Actions for Tue 6 Oct' }));
    expect(screen.queryByRole('menuitem', { name: /bank holiday/ })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Actions for Mon 5 Oct' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Mark bank holiday as worked' }));
    expect(screen.getByText('Bank holiday · worked')).toBeInTheDocument();
    expect(row('Mon 5 Oct')).toHaveTextContent('Unsaved');
    expect(row('Mon 5 Oct')).toHaveTextContent('−7:30 under');
  });

  it('shows the Converted column only with the switch on, as a preview before settlement', async () => {
    stubWeek({
      converting: true,
      days: [
        workDay(WEEK, { startsAt: '2026-10-05T07:00:00.000Z', endsAt: '2026-10-05T17:00:00.000Z' }),
      ],
    });
    await renderWeek({ today: '2026-10-07' });
    expect(
      await screen.findByRole('columnheader', { name: 'Converted (preview)' }),
    ).toBeInTheDocument();
  });

  it('has no Converted column with the switch off', async () => {
    stubWeek({});
    await renderWeek();
    await screen.findByText('No time recorded this week.');
    expect(screen.queryByRole('columnheader', { name: /Converted/ })).not.toBeInTheDocument();
  });

  it('asks for working terms before anything can be tracked', async () => {
    stubWeek({ terms: [] });
    await renderWeek();
    expect(
      await screen.findByText('Set your working terms to start tracking hours.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set working terms' })).toHaveAttribute(
      'href',
      '/hours/settings?tab=terms',
    );
  });

  it('says when tracking starts for an earlier week, and goes there', async () => {
    const user = userEvent.setup();
    stubWeek({});
    const { onWeekChange } = await renderWeek({ weekStart: '2026-08-31' });
    // ICU writes September as "Sept" in en-GB.
    expect(await screen.findByText(/^Tracking starts on Mon 7 Sept? 2026\.$/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to the first week' }));
    expect(onWeekChange).toHaveBeenCalledWith('2026-09-07');
  });

  it('keeps the header when the week fails to load, and retries', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubWeek(
      {},
      on('GET', '/api/v1/work-days', () =>
        fail ? { status: 500, body: { error: { code: 'INTERNAL', message: 'Boom.' } } } : page([]),
      ),
    );
    await renderWeek();
    expect(await screen.findByText("We couldn't load this week.")).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Start' })).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No time recorded this week.')).toBeInTheDocument();
  });

  it('moves by a week, and goes to today, focusing its Start field', async () => {
    const user = userEvent.setup();
    stubWeek({});
    const { onWeekChange } = await renderWeek({ today: '2026-10-07' });
    await screen.findByText('No time recorded this week.');
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(onWeekChange).toHaveBeenLastCalledWith('2026-09-28');
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(onWeekChange).toHaveBeenLastCalledWith('2026-10-12');
    await user.click(screen.getByRole('button', { name: 'Go to today' }));
    expect(field('Start', 'Wed 7 Oct')).toHaveFocus();
    expect(row('Wed 7 Oct')).toHaveTextContent('Today');
  });

  it('asks before leaving with unsaved rows', async () => {
    const user = userEvent.setup();
    stubWeek({});
    const { router } = await renderWeek();
    await user.type(await screen.findByRole('textbox', { name: 'Leave, Thu 8 Oct' }), '1h');
    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes?' });
    expect(dialog).toHaveTextContent("Thu 8 Oct has changes you haven't saved.");
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('link', { name: 'Elsewhere' })).toHaveFocus());
    expect(router.state.location.pathname).toBe('/');
    expect(field('Leave', 'Thu 8 Oct')).toHaveValue('1:00');

    await user.click(screen.getByRole('link', { name: 'Elsewhere' }));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    expect(await screen.findByRole('heading', { name: 'Elsewhere' })).toBeInTheDocument();
  });

  it('downloads the saved week as CSV', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:week';
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    stubWeek({
      days: [
        workDay(WEEK, { startsAt: '2026-10-05T07:00:00.000Z', endsAt: '2026-10-05T16:30:00.000Z' }),
      ],
    });
    await renderWeek();
    await screen.findByRole('textbox', { name: 'Start, Mon 5 Oct' });
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(clicks).toEqual(['hours-2026-10-05.csv']);
    const text = await blobs[0]!.text();
    expect(text).toContain('Date,Start,End');
    expect(text).toContain('2026-10-05,08:00,17:30,No');
    expect(await screen.findByText('Week of 5 Oct 2026 downloaded')).toBeInTheDocument();
  });
});

/** The worked example's week of 5 Oct 2026, saved (London times; BST is UTC+1). */
const EXAMPLE_DAYS = [
  workDay('2026-10-05', {
    startsAt: '2026-10-05T07:00:00.000Z',
    endsAt: '2026-10-05T16:30:00.000Z',
    breakMinutes: 30,
  }),
  workDay('2026-10-06', {
    startsAt: '2026-10-06T06:30:00.000Z',
    endsAt: '2026-10-06T17:00:00.000Z',
    breakMinutes: 30,
  }),
  workDay('2026-10-07', {
    startsAt: '2026-10-07T07:00:00.000Z',
    endsAt: '2026-10-07T15:00:00.000Z',
    breakMinutes: 30,
  }),
  workDay('2026-10-08', {
    startsAt: '2026-10-08T07:00:00.000Z',
    endsAt: '2026-10-08T16:00:00.000Z',
    breakMinutes: 15,
  }),
  workDay('2026-10-09', {
    startsAt: '2026-10-09T07:00:00.000Z',
    endsAt: '2026-10-09T12:30:00.000Z',
  }),
];

/**
 * The week view with its aside against a stubbed API: the worked example's
 * week, a switch that can change, and summaries the test controls.
 */
function stubWithAside({
  switchedOn = true,
  onSave,
}: { switchedOn?: boolean; onSave?: () => SummaryGroup } = {}) {
  const aside = {
    switchedOn,
    group: summaryGroup(),
  };
  const conversionRow = { id: 'switch-1', ownerId: 'owner', weekStart: WEEK, createdAt: WEEK };
  const api = stubWeek(
    { days: EXAMPLE_DAYS },
    on('PATCH', /^\/api\/v1\/work-days\//, (call: ApiCall) => {
      const id = call.path.split('/').at(-1);
      const before = api.state.days.find((day) => day.id === id)!;
      const saved = { ...before, ...(call.body as Partial<WorkDay>), version: 2 };
      api.state.days = api.state.days.map((day) => (day.id === id ? saved : day));
      if (onSave) aside.group = onSave();
      return { status: 200, body: { data: saved } };
    }),
    on('GET', '/api/v1/excess-conversions', () => page(aside.switchedOn ? [conversionRow] : [])),
    on('POST', '/api/v1/excess-conversions', () => {
      aside.switchedOn = true;
      return { status: 201, body: { data: conversionRow } };
    }),
    on('DELETE', '/api/v1/excess-conversions/switch-1', () => {
      aside.switchedOn = false;
      return { status: 204 };
    }),
    on('GET', '/api/v1/time-summaries', () => ({ status: 200, body: { data: [aside.group] } })),
    on('GET', '/api/v1/time-balances', () => ({ status: 200, body: { data: timeBalances() } })),
  );
  return { ...api, aside };
}

/** A headline tile's figure and detail, by its label. */
function tile(tiles: HTMLElement, label: string): string | null | undefined {
  return within(tiles).getByText(label).nextElementSibling?.textContent;
}

describe('WeekView with its aside', () => {
  it('shows the headline tiles and a named aside, following unsaved typing', async () => {
    const user = userEvent.setup();
    stubWithAside();
    await renderWeek({ withAside: true });

    const tiles = await screen.findByRole('region', { name: 'Headline figures' });
    const aside = await screen.findByRole('complementary', { name: 'This week and balances' });
    const conversion = within(aside).getByRole('region', { name: 'Conversion' });
    expect(await within(tiles).findByText('of 37:30 target')).toBeInTheDocument();
    expect(tile(tiles, 'Credited')).toBe('40:30 of 37:30 target');
    expect(tile(tiles, 'Week flexi')).toBe('+3:00 over 3:00 converted Fri 9 Oct');
    expect(await within(conversion).findByText('2:00 unpaid')).toBeInTheDocument();
    await within(tiles).findByText('+3:12 over');
    expect(tile(tiles, 'Flexi balance')).toBe('+3:12 over To the end of Mon 12 Oct');
    expect(
      await within(aside).findByRole('region', { name: 'TOIL and overtime' }),
    ).toBeInTheDocument();

    // An unsaved hour more on Wednesday: the week-local figures follow at once;
    // the TOIL and overtime split waits for the saved figures.
    const end = field('End', 'Wed 7 Oct');
    await user.clear(end);
    await user.type(end, '1700');
    expect(tile(tiles, 'Credited')).toBe('41:30 of 37:30 target');
    expect(within(tiles).getByText('+4:00 over')).toBeInTheDocument();
    expect(within(conversion).getByText('2:00 unpaid')).toBeInTheDocument();
  });

  it("links to the summary for the week's month, and to settings", async () => {
    stubWithAside();
    await renderWeek({ withAside: true });
    expect(await screen.findByRole('link', { name: 'Summary' })).toHaveAttribute(
      'href',
      '/hours/summary?from=2026-10-01&to=2026-10-31&groupBy=week',
    );
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/hours/settings',
    );
  });

  it("switching conversion in the aside updates the table's Converted column", async () => {
    const user = userEvent.setup();
    const { aside } = stubWithAside({ switchedOn: false });
    aside.group = summaryGroup({ conversion: 'OFF', conversionToilMinutes: 0 });
    await renderWeek({ withAside: true });
    const toggle = await screen.findByRole('switch', {
      name: "Convert this week's excess to TOIL and overtime",
    });
    await screen.findByText('Fri 9 Oct', { selector: 'span' });
    expect(screen.queryByRole('columnheader', { name: /Converted/ })).not.toBeInTheDocument();

    aside.group = summaryGroup();
    await user.click(toggle);
    expect(await screen.findByRole('columnheader', { name: 'Converted' })).toBeInTheDocument();
    // Tuesday gives four 0:30 blocks (2:00) in the worked example, leaving +0:30.
    expect(row('Tue 6 Oct')).toHaveTextContent('2:00');
    expect(row('Tue 6 Oct')).toHaveTextContent('+0:30 over');

    aside.group = summaryGroup({ conversion: 'OFF', conversionToilMinutes: 0 });
    await user.click(toggle);
    await waitFor(() =>
      expect(screen.queryByRole('columnheader', { name: /Converted/ })).not.toBeInTheDocument(),
    );
  });

  it('tells the owner when a save after settlement moves the TOIL and overtime', async () => {
    const user = userEvent.setup();
    const { calls } = stubWithAside({
      // One hour less on Tuesday: 2:00 excess, 1:00 of it overtime.
      onSave: () =>
        summaryGroup({
          creditedMinutes: 2370,
          rawFlexiMinutes: 120,
          excessMinutes: 120,
          conversionOvertimeUnpaidMinutes: 60,
        }),
    });
    await renderWeek({ withAside: true });
    const thisWeek = await screen.findByRole('region', { name: 'Conversion' });
    await within(thisWeek).findByText('2:00 unpaid');

    const end = field('End', 'Tue 6 Oct');
    await user.clear(end);
    await user.type(end, '1700{Enter}');

    const message = 'Week of 5 Oct recalculated: TOIL 1:00 → 1:00, overtime 2:00 → 1:00.';
    expect(await screen.findByText('Tue 6 Oct saved')).toBeInTheDocument();
    const notice = await within(thisWeek).findByText(message);
    expect(notice).toHaveAttribute('aria-live', 'polite');
    expect(
      within(screen.getByRole('region', { name: 'Notifications' })).getByText(message),
    ).toBeInTheDocument();
    expect(within(thisWeek).getByText('1:00 unpaid')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'PATCH')).toBe(true);
  });

  it('says nothing more than "saved" for an edit before settlement', async () => {
    const user = userEvent.setup();
    const { aside } = stubWithAside();
    aside.group = summaryGroup({ conversion: 'PREVIEW' });
    await renderWeek({ withAside: true, today: '2026-10-08' });
    const thisWeek = await screen.findByRole('region', { name: 'Conversion' });
    await within(thisWeek).findByText('Preview until Fri 9 Oct');
    await user.type(field('Break', 'Thu 8 Oct'), '{Control>}a{/Control}0:45{Enter}');
    expect(await screen.findByText('Thu 8 Oct saved')).toBeInTheDocument();
    expect(screen.queryByText(/recalculated/)).not.toBeInTheDocument();
  });
});
