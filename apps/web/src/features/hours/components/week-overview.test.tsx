import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SummaryGroup, TimeBalances } from '../api/keys';

import { WeekOverview } from './week-overview';

import { on, renderWithApi, stubApi } from '@/test/api-stub';
import { summaryGroup, timeBalances } from '@/test/hours-fixtures';

const WEEK = '2026-10-05';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stub(group: SummaryGroup, balances: TimeBalances = timeBalances()) {
  return stubApi(
    on('GET', '/api/v1/time-summaries', () => ({ status: 200, body: { data: [group] } })),
    on('GET', '/api/v1/time-balances', () => ({ status: 200, body: { data: balances } })),
  );
}

function render(asOf = '2026-10-14') {
  renderWithApi(
    <WeekOverview weekStart={WEEK} asOf={asOf} calculation={null} recalculationNotice="" />,
  );
}

/** A tile's figure and detail, as a screen reader reads its `<dd>`. */
async function tile(label: string): Promise<string | null | undefined> {
  const tiles = await screen.findByRole('region', { name: 'Headline figures' });
  return within(tiles).getByText(label).nextElementSibling?.textContent;
}

describe('WeekOverview', () => {
  it('shows credited, the week flexi, the flexi balance and the leave left', async () => {
    const { calls } = stub(summaryGroup());
    render();
    expect(await screen.findByText('+3:12 over')).toBeInTheDocument();
    expect(await tile('Credited')).toBe('40:30 of 37:30 target');
    expect(await tile('Week flexi')).toBe('+3:00 over 3:00 converted Fri 9 Oct');
    expect(await tile('Flexi balance')).toBe('+3:12 over To the end of Wed 14 Oct');
    expect(await tile('Leave left 2026')).toBe('120:00 of 247:30 allowance');
    const summary = calls.find((call) => call.path === '/api/v1/time-summaries');
    expect(Object.fromEntries(summary?.search ?? [])).toEqual({
      from: WEEK,
      to: '2026-10-12',
      groupBy: 'week',
      asOf: '2026-10-14',
    });
  });

  it('says what conversion will do before settlement, and when it is off', async () => {
    stub(summaryGroup({ conversion: 'PREVIEW' }));
    render('2026-10-08');
    await screen.findByText('+3:12 over');
    expect(await tile('Week flexi')).toBe('+3:00 over 3:00 converts Fri 9 Oct');
  });

  it('keeps an unconverted excess as flexi', async () => {
    stub(summaryGroup({ conversion: 'OFF', conversionMinutes: 0 }));
    render();
    await screen.findByText('+3:12 over');
    expect(await tile('Week flexi')).toBe('+3:00 over Stays as flexi');
  });

  it('shows a negative flexi balance and leave over the allowance in words', async () => {
    stub(summaryGroup(), timeBalances({ flexiMinutes: -130, leaveRemainingMinutes: -450 }));
    render();
    await screen.findByText('−2:10 under');
    expect(await tile('Flexi balance')).toBe('−2:10 under To the end of Wed 14 Oct');
    expect(await tile('Leave left 2026')).toBe('−7:30 Over allowance');
  });

  it('marks the tiles busy while loading, and offers Retry when a load fails', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubApi(
      on('GET', '/api/v1/time-summaries', () => ({
        status: 200,
        body: { data: [summaryGroup()] },
      })),
      on('GET', '/api/v1/time-balances', () =>
        fail
          ? { status: 500, body: { error: { code: 'INTERNAL', message: 'Boom.' } } }
          : { status: 200, body: { data: timeBalances() } },
      ),
    );
    render();
    expect(await screen.findByText("We couldn't load this week's figures.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('+3:12 over')).toBeInTheDocument();
  });
});
