import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TimeBalances } from '../api/keys';

import { BalancesPanel } from './balances-panel';

import { on, renderWithApi, stubApi } from '@/test/api-stub';
import { timeBalances } from '@/test/hours-fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
});

const respond = (data: TimeBalances) =>
  on('GET', '/api/v1/time-balances', () => ({ status: 200, body: { data } }));

function figure(panel: HTMLElement, term: string): string | null | undefined {
  return within(panel).getByText(term).nextElementSibling?.textContent;
}

describe('BalancesPanel', () => {
  it('shows TOIL against its cap, TOIL taken and overtime, as of the date', async () => {
    const { calls } = stubApi(respond(timeBalances()));
    renderWithApi(<BalancesPanel asOf="2026-10-14" />);

    const panel = await screen.findByRole('region', { name: 'TOIL and overtime' });
    expect(within(panel).getByText('To the end of Wed 14 Oct')).toBeInTheDocument();
    await within(panel).findByText('TOIL October');
    expect(figure(panel, 'TOIL October')).toBe('7:30 of 7:30');
    expect(figure(panel, 'TOIL taken October')).toBe('0:00');
    expect(figure(panel, 'Overtime 2026')).toBe('0:00 paid, 2:00 unpaid');
    // The flexi balance and the leave left are headline tiles (WeekOverview).
    expect(within(panel).queryByText('Flexi')).not.toBeInTheDocument();
    expect(calls[0]?.search.get('asOf')).toBe('2026-10-14');
  });

  it('says there is nothing to show before any terms exist', async () => {
    stubApi(respond(timeBalances({ trackingStart: null })));
    renderWithApi(<BalancesPanel asOf="2026-10-14" />);
    expect(
      await screen.findByText('No balances yet. Set your working terms to start tracking hours.'),
    ).toBeInTheDocument();
  });

  it('offers Retry when the balances fail to load', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubApi(
      on('GET', '/api/v1/time-balances', () =>
        fail
          ? { status: 500, body: { error: { code: 'INTERNAL', message: 'Boom.' } } }
          : { status: 200, body: { data: timeBalances() } },
      ),
    );
    renderWithApi(<BalancesPanel asOf="2026-10-14" />);
    expect(await screen.findByText("We couldn't load your balances.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('7:30 of 7:30')).toBeInTheDocument();
  });
});
