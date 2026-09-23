import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TimeAdjustment } from '../api/keys';

import { BalancesTab } from './balances-tab';

import { dismissToast } from '@/components/ui/toast';
import { on, page, renderWithApi, stubApi } from '@/test/api-stub';

function adjustment(overrides: Partial<TimeAdjustment> = {}): TimeAdjustment {
  return {
    id: 'a1',
    ownerId: 'owner',
    effectiveDate: '2026-10-05',
    balance: 'FLEXI',
    minutes: 150,
    reason: 'OPENING_BALANCE',
    version: 1,
    createdAt: '2026-10-05T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
    ...overrides,
  };
}

const terms = { id: 't1', effectiveFrom: '2026-10-05' };

afterEach(() => {
  act(() => dismissToast());
  vi.unstubAllGlobals();
});

describe('BalancesTab', () => {
  it('adds a signed adjustment dated on the tracking start', async () => {
    const user = userEvent.setup();
    const { calls } = stubApi(
      on('GET', '/api/v1/time-adjustments', () => page([])),
      on('GET', '/api/v1/work-terms', () => page([terms])),
      on('POST', '/api/v1/time-adjustments', (call) => ({
        status: 201,
        body: { data: adjustment(call.body as Partial<TimeAdjustment>) },
      })),
    );
    renderWithApi(<BalancesTab />);

    expect(await screen.findByText('No adjustments yet.')).toBeInTheDocument();
    expect(
      await screen.findByText(/Date opening balances on your tracking start, Mon 5 Oct 2026/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-10-05');

    await user.selectOptions(screen.getByLabelText('Balance'), 'TOIL');
    await user.type(screen.getByLabelText('Amount'), '-1:30');
    await user.click(screen.getByRole('button', { name: 'Add adjustment' }));

    expect(await screen.findByText('TOIL adjustment of −1:30 added')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      effectiveDate: '2026-10-05',
      balance: 'TOIL',
      reason: 'OPENING_BALANCE',
      minutes: -90,
    });
  });

  it('refuses an empty amount before sending anything', async () => {
    const user = userEvent.setup();
    const { calls } = stubApi(
      on('GET', '/api/v1/time-adjustments', () => page([])),
      on('GET', '/api/v1/work-terms', () => page([])),
    );
    renderWithApi(<BalancesTab />);
    await user.click(await screen.findByRole('button', { name: 'Add adjustment' }));
    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription(
      /Enter hours and minutes, such as 7:30 or −2:00\./,
    );
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('deletes an adjustment with undo', async () => {
    const user = userEvent.setup();
    let rows = [adjustment()];
    const { calls } = stubApi(
      on('GET', '/api/v1/time-adjustments', () => page(rows)),
      on('GET', '/api/v1/work-terms', () => page([terms])),
      on('DELETE', '/api/v1/time-adjustments/a1', () => {
        rows = [];
        return { status: 204 };
      }),
      on('POST', '/api/v1/time-adjustments/a1/restore', () => {
        rows = [adjustment()];
        return { status: 200, body: { data: rows[0] } };
      }),
    );
    renderWithApi(<BalancesTab />);

    expect(await screen.findByText('+2:30')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Delete Flexi adjustment of +2:30 on Mon 5 Oct 2026',
      }),
    );
    expect(await screen.findByText('Flexi opening balance deleted')).toBeInTheDocument();
    expect(await screen.findByText('No adjustments yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Flexi opening balance restored')).toBeInTheDocument();
    expect(await screen.findByText('+2:30')).toBeInTheDocument();
    expect(calls.some((call) => call.path.endsWith('/restore'))).toBe(true);
  });
});
