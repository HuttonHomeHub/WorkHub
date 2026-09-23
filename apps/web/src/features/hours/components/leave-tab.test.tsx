import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LeaveYear } from '../api/keys';

import { LeaveTab } from './leave-tab';

import { dismissToast } from '@/components/ui/toast';
import { on, page, renderWithApi, stubApi } from '@/test/api-stub';

function leaveYear(overrides: Partial<LeaveYear> = {}): LeaveYear {
  return {
    id: 'y2026',
    ownerId: 'owner',
    year: 2026,
    allowanceMinutes: 14_850,
    boughtLeave: false,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

afterEach(() => {
  act(() => dismissToast());
  vi.unstubAllGlobals();
});

describe('LeaveTab', () => {
  it('lists each year with its allowance and total, and says used and remaining are to come', async () => {
    stubApi(on('GET', '/api/v1/leave-years', () => page([leaveYear({ boughtLeave: true })])));
    renderWithApi(<LeaveTab />);

    expect(await screen.findByLabelText('Allowance for 2026')).toHaveValue('247:30');
    const row = screen.getByRole('row', { name: /2026/ });
    expect(within(row).getByText('285:00')).toBeInTheDocument();
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(screen.getByRole('table')).toHaveAccessibleDescription(
      /Used and remaining hours are not worked out yet/,
    );
  });

  it('saves bought leave as soon as it is switched, with a quiet "Saved"', async () => {
    const user = userEvent.setup();
    let row = leaveYear();
    const { calls } = stubApi(
      on('GET', '/api/v1/leave-years', () => page([row])),
      on('PATCH', '/api/v1/leave-years/y2026', (call) => {
        const body = call.body as { boughtLeave: boolean };
        row = { ...row, boughtLeave: body.boughtLeave, version: row.version + 1 };
        return { status: 200, body: { data: row } };
      }),
    );
    renderWithApi(<LeaveTab />);

    const toggle = await screen.findByRole('switch', { name: 'Bought leave for 2026' });
    await user.click(toggle);

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(calls.find((call) => call.method === 'PATCH')?.body).toEqual({
      allowanceMinutes: 14_850,
      boughtLeave: true,
      version: 1,
    });
    expect(await screen.findByText('285:00')).toBeInTheDocument();
  });

  it('offers Reload when bought leave changed elsewhere (409)', async () => {
    const user = userEvent.setup();
    stubApi(
      on('GET', '/api/v1/leave-years', () => page([leaveYear()])),
      on('PATCH', '/api/v1/leave-years/y2026', () => ({
        status: 409,
        body: { error: { code: 'CONFLICT', message: 'Modified elsewhere.' } },
      })),
    );
    renderWithApi(<LeaveTab />);
    await user.click(await screen.findByRole('switch', { name: 'Bought leave for 2026' }));
    expect(await screen.findByText("We couldn't change bought leave for 2026")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Bought leave for 2026' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('adds a leave year, suggesting this year when it is missing', async () => {
    const user = userEvent.setup();
    const { calls } = stubApi(
      on('GET', '/api/v1/leave-years', () => page([])),
      on('POST', '/api/v1/leave-years', (call) => ({
        status: 201,
        body: { data: leaveYear(call.body as Partial<LeaveYear>) },
      })),
    );
    renderWithApi(<LeaveTab />);

    expect(
      await screen.findByText('No leave years yet. Add this year to track your allowance.'),
    ).toBeInTheDocument();
    const year = screen.getByLabelText('Year');
    expect(year).toHaveValue(String(new Date().getFullYear()));
    await user.clear(year);
    await user.type(year, '2027');
    await user.click(screen.getByRole('button', { name: 'Add leave year' }));

    expect(await screen.findByText('Leave year 2027 added')).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      year: 2027,
      allowanceMinutes: 14_850,
      boughtLeave: false,
    });
  });

  it('explains a duplicate year (409) at the top of the form', async () => {
    const user = userEvent.setup();
    stubApi(
      on('GET', '/api/v1/leave-years', () => page([])),
      on('POST', '/api/v1/leave-years', () => ({
        status: 409,
        body: { error: { code: 'CONFLICT', message: 'Exists.' } },
      })),
    );
    renderWithApi(<LeaveTab />);
    await user.click(await screen.findByRole('button', { name: 'Add leave year' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That year is already set up.');
  });
});
