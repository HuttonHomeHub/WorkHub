import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExcessConversion, SummaryGroup } from '../api/keys';
import type { LiveWeekFigures } from '../this-week-figures';

import { ThisWeekPanel } from './this-week-panel';

import { dismissToast } from '@/components/ui/toast';
import { on, page, renderWithApi, stubApi } from '@/test/api-stub';
import { summaryGroup } from '@/test/hours-fixtures';

const WEEK = '2026-10-05';

function conversionRow(): ExcessConversion {
  return {
    id: '0199a000-0000-7000-8000-000000000001',
    ownerId: 'owner',
    weekStart: WEEK,
    createdAt: '2026-10-05T09:00:00.000Z',
  };
}

/** A stubbed API holding the week's switch, whose summary follows it. */
function stubWeek({
  switchedOn,
  group,
}: {
  switchedOn: boolean;
  group: (on: boolean) => SummaryGroup;
}) {
  let row: ExcessConversion | null = switchedOn ? conversionRow() : null;
  return stubApi(
    on('GET', '/api/v1/time-summaries', () => ({
      status: 200,
      body: { data: [group(row !== null)] },
    })),
    on('GET', '/api/v1/excess-conversions', () => page(row ? [row] : [])),
    on('POST', '/api/v1/excess-conversions', () => {
      row = conversionRow();
      return { status: 201, body: { data: row } };
    }),
    on('DELETE', /^\/api\/v1\/excess-conversions\//, () => {
      row = null;
      return { status: 204 };
    }),
  );
}

/** The worked example: applied from Fri 9 Oct when on. */
const applied = (isOn: boolean) =>
  summaryGroup(
    isOn
      ? {}
      : {
          conversion: 'OFF',
          convertedMinutes: 0,
          flexiMinutes: 180,
          conversionMinutes: 0,
          toilMinutes: 0,
          overtimeUnpaidMinutes: 0,
          conversionToilMinutes: 0,
          conversionOvertimeUnpaidMinutes: 0,
        },
  );

afterEach(() => {
  act(() => dismissToast());
  vi.unstubAllGlobals();
});

describe('ThisWeekPanel', () => {
  it('shows the switch off, with nothing after conversion', async () => {
    const { calls } = stubWeek({ switchedOn: false, group: applied });
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    const panel = await screen.findByRole('region', { name: 'Conversion' });
    await within(panel).findByRole('switch');
    // Credited and the week flexi are headline tiles (WeekOverview).
    expect(within(panel).queryByText(/of 37:30 target/)).not.toBeInTheDocument();
    expect(within(panel).queryByText('After conversion')).not.toBeInTheDocument();
    expect(
      within(panel).getByRole('switch', {
        name: "Convert this week's excess to TOIL and overtime",
      }),
    ).toHaveAttribute('aria-checked', 'false');
    const summary = calls.find((call) => call.path === '/api/v1/time-summaries');
    expect(Object.fromEntries(summary?.search ?? [])).toEqual({
      from: WEEK,
      to: '2026-10-12',
      groupBy: 'week',
      asOf: '2026-10-12',
    });
  });

  it('switches conversion on with a quiet "Saved", and shows what it applied', async () => {
    const user = userEvent.setup();
    const { calls } = stubWeek({ switchedOn: false, group: applied });
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    const toggle = await screen.findByRole('switch', {
      name: "Convert this week's excess to TOIL and overtime",
    });
    await user.click(toggle);

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(toggle).toHaveFocus();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ weekStart: WEEK });
    expect(await screen.findByText('Applied Fri 9 Oct')).toBeInTheDocument();
    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(screen.getByText('2:00 unpaid')).toBeInTheDocument();
    expect(screen.getByText('After conversion').nextElementSibling).toHaveTextContent('0:00');
    // No toast: switching back is the undo.
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('switches it off again with the keyboard (the undo)', async () => {
    const user = userEvent.setup();
    const { calls } = stubWeek({ switchedOn: true, group: applied });
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    const toggle = await screen.findByRole('switch', {
      name: "Convert this week's excess to TOIL and overtime",
    });
    expect(await screen.findByText('Applied Fri 9 Oct')).toBeInTheDocument();
    toggle.focus();
    await user.keyboard(' ');

    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(calls.find((call) => call.method === 'DELETE')?.path).toBe(
      `/api/v1/excess-conversions/${conversionRow().id}`,
    );
    expect(screen.queryByText('Applied Fri 9 Oct')).not.toBeInTheDocument();
  });

  it('shows a preview until the settlement day', async () => {
    stubWeek({
      switchedOn: true,
      group: () =>
        summaryGroup({
          conversion: 'PREVIEW',
          convertedMinutes: 0,
          flexiMinutes: 180,
          toilMinutes: 0,
          overtimeUnpaidMinutes: 0,
        }),
    });
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-08" />);

    expect(await screen.findByText('Preview until Fri 9 Oct')).toBeInTheDocument();
    expect(screen.getByText('2:00 unpaid')).toBeInTheDocument();
  });

  it('says there is nothing to convert in a net zero or negative week', async () => {
    stubWeek({
      switchedOn: true,
      group: () =>
        summaryGroup({
          rawFlexiMinutes: -60,
          excessMinutes: 0,
          conversionToilMinutes: 0,
          conversionOvertimeUnpaidMinutes: 0,
        }),
    });
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    expect(await screen.findByText('Nothing to convert')).toBeInTheDocument();
    expect(screen.queryByText('After conversion')).not.toBeInTheDocument();
    expect(screen.queryByText(/Applied/)).not.toBeInTheDocument();
  });

  it('says what stays as flexi when the excess is not a whole number of blocks', async () => {
    stubWeek({
      switchedOn: true,
      group: () =>
        summaryGroup({
          rawFlexiMinutes: 165,
          excessMinutes: 165,
          conversionMinutes: 150,
          convertedMinutes: 150,
          conversionToilMinutes: 60,
          conversionOvertimeUnpaidMinutes: 90,
        }),
    });
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    expect(await screen.findByText('0:15 stays as flexi')).toBeInTheDocument();
    expect(screen.getByText('After conversion').nextElementSibling).toHaveTextContent('+0:15 over');
    expect(screen.getByText('1:30 unpaid')).toBeInTheDocument();
    expect(screen.getByText('Applied Fri 9 Oct')).toBeInTheDocument();
  });

  it('says when the excess is less than one block', async () => {
    stubWeek({
      switchedOn: true,
      group: () =>
        summaryGroup({
          rawFlexiMinutes: 10,
          excessMinutes: 10,
          conversionMinutes: 0,
          convertedMinutes: 0,
          conversionToilMinutes: 0,
          conversionOvertimeUnpaidMinutes: 0,
        }),
    });
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    expect(await screen.findByText('Less than one block (0:30) to convert')).toBeInTheDocument();
    expect(screen.queryByText(/stays as flexi/)).not.toBeInTheDocument();
    expect(screen.queryByText('Nothing to convert')).not.toBeInTheDocument();
  });

  it('keeps the switch as saved and raises a persistent error when the save fails', async () => {
    const user = userEvent.setup();
    stubApi(
      on('GET', '/api/v1/time-summaries', () => ({
        status: 200,
        body: { data: [applied(false)] },
      })),
      on('GET', '/api/v1/excess-conversions', () => page([])),
      on('POST', '/api/v1/excess-conversions', () => ({
        status: 500,
        body: { error: { code: 'INTERNAL', message: 'Boom.' } },
      })),
    );
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    const toggle = await screen.findByRole('switch');
    await user.click(toggle);
    expect(
      await screen.findByText("We couldn't switch conversion on for this week"),
    ).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('treats "already on" (409) as switched on', async () => {
    const user = userEvent.setup();
    let row: ExcessConversion | null = null;
    stubApi(
      on('GET', '/api/v1/time-summaries', () => ({ status: 200, body: { data: [applied(true)] } })),
      on('GET', '/api/v1/excess-conversions', () => page(row ? [row] : [])),
      on('POST', '/api/v1/excess-conversions', () => {
        row = conversionRow();
        return { status: 409, body: { error: { code: 'CONFLICT', message: 'Already on.' } } };
      }),
    );
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);
    await user.click(await screen.findByRole('switch'));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('lays live figures from unsaved rows over the saved summary, keeping the saved split', async () => {
    stubWeek({ switchedOn: true, group: applied });
    const live: LiveWeekFigures = {
      targetMinutes: 2250,
      creditedMinutes: 2490,
      rawFlexiMinutes: 240,
      excessMinutes: 240,
      blockMinutes: 30,
      convertedMinutes: 240,
    };
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" live={live} />);

    const panel = await screen.findByRole('region', { name: 'Conversion' });
    // After conversion follows the live figures: 4:00 − 4:00 converted.
    expect(
      (await within(panel).findByText('After conversion')).nextElementSibling,
    ).toHaveTextContent('0:00');
    // The split is the saved one until the save is re-read.
    expect(within(panel).getByText('1:00')).toBeInTheDocument();
    expect(within(panel).getByText('2:00 unpaid')).toBeInTheDocument();
    expect(within(panel).getByText('Applied Fri 9 Oct')).toBeInTheDocument();
  });

  it('announces a recalculation in a polite live region', async () => {
    stubWeek({ switchedOn: false, group: applied });
    renderWithApi(
      <ThisWeekPanel
        weekStart={WEEK}
        asOf="2026-10-12"
        recalculationNotice="Week of 5 Oct recalculated: TOIL 3:00 → 2:00, overtime 0:00 → 0:00."
      />,
    );
    const panel = await screen.findByRole('region', { name: 'Conversion' });
    const notice = within(panel).getByText(/Week of 5 Oct recalculated/);
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('offers Retry when the totals fail to load', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubApi(
      on('GET', '/api/v1/time-summaries', () =>
        fail
          ? { status: 500, body: { error: { code: 'INTERNAL', message: 'Boom.' } } }
          : { status: 200, body: { data: [applied(false)] } },
      ),
      on('GET', '/api/v1/excess-conversions', () => page([])),
    );
    renderWithApi(<ThisWeekPanel weekStart={WEEK} asOf="2026-10-12" />);

    expect(await screen.findByText("We couldn't load this week's totals.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('switch')).toBeInTheDocument();
  });
});
