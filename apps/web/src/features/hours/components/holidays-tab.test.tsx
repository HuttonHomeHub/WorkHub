import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HolidaysTab } from './holidays-tab';

import { dismissToast } from '@/components/ui/toast';
import type { PublicHoliday } from '@/features/core/public-holidays';
import { on, page, renderWithApi, stubApi } from '@/test/api-stub';

function holiday(id: string, date: string, name: string): PublicHoliday {
  return {
    id,
    ownerId: 'owner',
    date,
    name,
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

afterEach(() => {
  act(() => dismissToast());
  vi.unstubAllGlobals();
});

describe('HolidaysTab', () => {
  it('asks for the shown year only, and imports its bank holidays', async () => {
    const user = userEvent.setup();
    let rows: PublicHoliday[] = [];
    const { calls } = stubApi(
      on('GET', '/api/v1/public-holidays', () => page(rows)),
      on('POST', '/api/v1/public-holiday-imports', () => {
        rows = [
          holiday('h1', '2026-01-01', "New Year's Day"),
          holiday('h2', '2026-12-25', 'Christmas Day'),
        ];
        return { status: 201, body: { data: { year: 2026, added: rows } } };
      }),
    );
    renderWithApi(<HolidaysTab year={2026} onYearChange={vi.fn()} />);

    expect(await screen.findByText('No holidays in 2026 yet.')).toBeInTheDocument();
    const list = calls.find((call) => call.method === 'GET');
    expect(list?.search.get('from')).toBe('2026-01-01');
    expect(list?.search.get('to')).toBe('2027-01-01');

    await user.click(
      screen.getByRole('button', { name: 'Add England and Wales bank holidays for 2026' }),
    );
    expect(await screen.findByText('2 bank holidays added for 2026')).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Christmas Day' })).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ year: 2026 });
  });

  it('says so when the year already has every bank holiday', async () => {
    const user = userEvent.setup();
    stubApi(
      on('GET', '/api/v1/public-holidays', () => page([])),
      on('POST', '/api/v1/public-holiday-imports', () => ({
        status: 200,
        body: { data: { year: 2026, added: [] } },
      })),
    );
    renderWithApi(<HolidaysTab year={2026} onYearChange={vi.fn()} />);
    await user.click(
      await screen.findByRole('button', { name: 'Add England and Wales bank holidays for 2026' }),
    );
    expect(
      await screen.findByText('You already have every England and Wales bank holiday for 2026'),
    ).toBeInTheDocument();
  });

  it('moves between years', async () => {
    const user = userEvent.setup();
    const onYearChange = vi.fn();
    stubApi(on('GET', '/api/v1/public-holidays', () => page([])));
    renderWithApi(<HolidaysTab year={2026} onYearChange={onYearChange} />);
    await user.click(screen.getByRole('button', { name: 'Next year' }));
    expect(onYearChange).toHaveBeenLastCalledWith(2027);
    await user.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(onYearChange).toHaveBeenLastCalledWith(2025);
  });

  it('adds a holiday by hand, and explains a date already taken', async () => {
    const user = userEvent.setup();
    let taken = false;
    stubApi(
      on('GET', '/api/v1/public-holidays', () => page([])),
      on('POST', '/api/v1/public-holidays', (call) => {
        if (taken) {
          return { status: 409, body: { error: { code: 'CONFLICT', message: 'Exists.' } } };
        }
        taken = true;
        const body = call.body as { date: string; name: string };
        return { status: 201, body: { data: holiday('h9', body.date, body.name) } };
      }),
    );
    renderWithApi(<HolidaysTab year={2026} onYearChange={vi.fn()} />);

    await user.type(await screen.findByLabelText('Date'), '2026-06-01');
    await user.type(screen.getByLabelText('Name'), '  Company day ');
    await user.click(screen.getByRole('button', { name: 'Add holiday' }));
    expect(await screen.findByText('Company day added')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Date'), '2026-06-01');
    await user.type(screen.getByLabelText('Name'), 'Again');
    await user.click(screen.getByRole('button', { name: 'Add holiday' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is already a holiday on that date.',
    );
  });

  it('deletes a holiday with undo, and focuses the next row', async () => {
    const user = userEvent.setup();
    const all = [
      holiday('h1', '2026-12-25', 'Christmas Day'),
      holiday('h2', '2026-12-28', 'Boxing Day (substitute day)'),
    ];
    let rows = all;
    stubApi(
      on('GET', '/api/v1/public-holidays', () => page(rows)),
      on('DELETE', '/api/v1/public-holidays/h1', () => {
        rows = all.slice(1);
        return { status: 204 };
      }),
      on('POST', '/api/v1/public-holidays/h1/restore', () => {
        rows = all;
        return { status: 200, body: { data: all[0] } };
      }),
    );
    renderWithApi(<HolidaysTab year={2026} onYearChange={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Delete Christmas Day' }));
    expect(await screen.findByText('Christmas Day deleted')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Boxing Day (substitute day)' }),
    ).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Christmas Day restored')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Delete Christmas Day' })).toBeInTheDocument();
  });
});
