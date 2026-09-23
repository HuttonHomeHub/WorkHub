import { act, configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkTerm } from '../api/keys';

import { TermsTab } from './terms-tab';

import { dismissToast } from '@/components/ui/toast';
import { on, page, renderWithApi, stubApi } from '@/test/api-stub';

function terms(id: string, effectiveFrom: string, overrides: Partial<WorkTerm> = {}): WorkTerm {
  return {
    id,
    ownerId: 'owner',
    effectiveFrom,
    targetMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 450, sat: null, sun: null },
    minimumMinutes: { mon: 450, tue: 450, wed: 450, thu: 450, fri: 330, sat: null, sun: null },
    breakThresholdMinutes: 360,
    breakMinimumMinutes: 30,
    bandStart: '07:00',
    bandEnd: '19:00',
    paidOvertimeAllowed: false,
    toilMonthlyCapMinutes: 450,
    leaveDayMaxMinutes: 450,
    flexiCreditCapMinutes: null,
    flexiDebitCapMinutes: null,
    version: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

// The terms form has some 40 fields, so role queries and typing over it are
// slow in jsdom; allow for that rather than skip the checks.
configure({ asyncUtilTimeout: 5_000 });
vi.setConfig({ testTimeout: 20_000 });

afterEach(() => {
  act(() => dismissToast());
  vi.unstubAllGlobals();
});

describe('TermsTab', () => {
  it('invites the owner to set terms when there are none, and saves the first', async () => {
    const user = userEvent.setup();
    let saved: WorkTerm[] = [];
    const { calls } = stubApi(
      on('GET', '/api/v1/work-terms', () => page(saved)),
      on('POST', '/api/v1/work-terms', (call) => {
        const body = call.body as { effectiveFrom: string };
        saved = [terms('t1', body.effectiveFrom)];
        return { status: 201, body: { data: saved[0] } };
      }),
    );
    renderWithApi(<TermsTab />);

    expect(
      await screen.findByText(/Set your working terms to start tracking hours/),
    ).toBeInTheDocument();
    expect(screen.getByText('No terms saved yet.')).toBeInTheDocument();

    const date = screen.getByLabelText('Applies from');
    await user.clear(date);
    await user.type(date, '2026-10-05');
    await user.click(screen.getByRole('button', { name: 'Save new terms' }));

    expect(await screen.findByText('Terms from Mon 5 Oct 2026 saved')).toBeInTheDocument();
    const post = calls.find((call) => call.method === 'POST');
    expect(post?.body).toMatchObject({
      effectiveFrom: '2026-10-05',
      targetMinutes: { mon: 450, sat: null },
      paidOvertimeAllowed: false,
    });
    expect(await screen.findByText('(current)')).toBeInTheDocument();
  });

  it('deletes terms at once, offers undo, and restores them', async () => {
    const user = userEvent.setup();
    let rows = [terms('t2', '2026-11-02'), terms('t1', '2026-10-05')];
    const all = [...rows];
    const { calls } = stubApi(
      on('GET', '/api/v1/work-terms', () => page(rows)),
      on('DELETE', /^\/api\/v1\/work-terms\/[^/]+$/, (call) => {
        rows = rows.filter((row) => !call.path.endsWith(row.id));
        return { status: 204 };
      }),
      on('POST', /\/restore$/, () => {
        rows = all;
        return { status: 200, body: { data: all[1] } };
      }),
    );
    renderWithApi(<TermsTab />);

    await user.click(
      await screen.findByRole('button', { name: 'Delete terms from Mon 5 Oct 2026' }),
    );
    expect(await screen.findByText('Terms from Mon 5 Oct 2026 deleted')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete terms from Mon 5 Oct 2026' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Terms restored')).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/api/v1/work-terms/t1/restore')).toBe(true);
    expect(
      await screen.findByRole('button', { name: 'Delete terms from Mon 5 Oct 2026' }),
    ).toBeInTheDocument();
  });

  it('moves focus to the next row after a delete', async () => {
    const user = userEvent.setup();
    let rows = [terms('t2', '2026-11-02'), terms('t1', '2026-10-05')];
    stubApi(
      on('GET', '/api/v1/work-terms', () => page(rows)),
      on('DELETE', /^\/api\/v1\/work-terms\/[^/]+$/, (call) => {
        rows = rows.filter((row) => !call.path.endsWith(row.id));
        return { status: 204 };
      }),
    );
    renderWithApi(<TermsTab />);
    await user.click(
      await screen.findByRole('button', { name: 'Delete terms from Mon 2 Nov 2026' }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Edit terms from Mon 5 Oct 2026' })).toHaveFocus(),
    );
  });

  it('keeps the last terms when the API refuses, and says why', async () => {
    const user = userEvent.setup();
    stubApi(
      on('GET', '/api/v1/work-terms', () => page([terms('t1', '2026-10-05')])),
      on('DELETE', /^\/api\/v1\/work-terms\//, () => ({
        status: 422,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'You cannot delete your only work terms. Add new terms first, or edit these.',
          },
        },
      })),
    );
    renderWithApi(<TermsTab />);
    await user.click(
      await screen.findByRole('button', { name: 'Delete terms from Mon 5 Oct 2026' }),
    );
    expect(await screen.findByText("We couldn't delete the terms")).toBeInTheDocument();
    expect(screen.getByText(/You cannot delete your only work terms/)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Delete terms from Mon 5 Oct 2026' }),
    ).toBeInTheDocument();
  });

  it('shows 422 details at the top of the form', async () => {
    const user = userEvent.setup();
    stubApi(
      on('GET', '/api/v1/work-terms', () => page([])),
      on('POST', '/api/v1/work-terms', () => ({
        status: 422,
        body: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The work terms are not valid.',
            details: ['Mon: the minimum cannot exceed the target.'],
          },
        },
      })),
    );
    renderWithApi(<TermsTab />);
    await user.click(await screen.findByRole('button', { name: 'Save new terms' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The work terms are not valid.');
    expect(within(alert).getByRole('listitem')).toHaveTextContent(
      'Mon: the minimum cannot exceed the target.',
    );
  });

  it('offers to reload when an edit hits a stale version (409)', async () => {
    const user = userEvent.setup();
    let version = 1;
    stubApi(
      on('GET', '/api/v1/work-terms', () => page([terms('t1', '2026-10-05', { version })])),
      on('PATCH', '/api/v1/work-terms/t1', () => {
        version = 2;
        return {
          status: 409,
          body: { error: { code: 'CONFLICT', message: 'These terms were modified elsewhere.' } },
        };
      }),
    );
    renderWithApi(<TermsTab />);
    await user.click(await screen.findByRole('button', { name: 'Edit terms from Mon 5 Oct 2026' }));
    expect(
      screen.getByRole('heading', { name: 'Edit terms from Mon 5 Oct 2026' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('These terms were changed somewhere else.');
    await user.click(within(alert).getByRole('button', { name: 'Reload the latest' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(
      screen.getByRole('heading', { name: 'Edit terms from Mon 5 Oct 2026' }),
    ).toBeInTheDocument();
  });

  it('shows an error with Retry when the terms cannot load', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubApi(
      on('GET', '/api/v1/work-terms', () =>
        fail
          ? { status: 500, body: { error: { code: 'INTERNAL_ERROR', message: 'Boom.' } } }
          : page([]),
      ),
    );
    renderWithApi(<TermsTab />);
    expect(await screen.findByText("We couldn't load your terms.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('No terms saved yet.')).toBeInTheDocument();
  });
});
