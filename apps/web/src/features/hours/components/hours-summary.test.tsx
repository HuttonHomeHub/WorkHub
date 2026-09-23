import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SummaryGroup } from '../api/keys';

import { HoursSummary, type HoursSummaryProps, type SummarySearch } from './hours-summary';

import { dismissToast } from '@/components/ui/toast';
import { type ApiCall, on, renderWithApi, stubApi } from '@/test/api-stub';
import { summaryGroup, timeBalances } from '@/test/hours-fixtures';

const TODAY = '2026-10-14';

/** Two weeks of October 2026 (the second is the worked example, applied). */
const weeks: SummaryGroup[] = [
  summaryGroup({
    key: '2026-09-28',
    start: '2026-09-28',
    end: '2026-10-05',
    creditedMinutes: 2120,
    workedMinutes: 2120,
    rawFlexiMinutes: -130,
    flexiMinutes: -130,
    convertedMinutes: 0,
    toilMinutes: 0,
    overtimeUnpaidMinutes: 0,
    flexiBalanceEndMinutes: 12,
    conversion: 'OFF',
    warnings: [
      { code: 'MISSING_DAY', date: '2026-09-28' },
      { code: 'BELOW_MINIMUM', date: '2026-09-30' },
      { code: 'BELOW_MINIMUM', date: '2026-10-01' },
    ],
  }),
  summaryGroup(),
];

const october: SummaryGroup = summaryGroup({
  key: '2026-10',
  start: '2026-10-01',
  end: '2026-11-01',
  targetMinutes: 10_350,
  creditedMinutes: 4_550,
  workedMinutes: 4_550,
});
// Month groups carry no conversion.
delete october.conversion;

function stubSummaries(respond: (call: ApiCall) => { status: number; body?: unknown }) {
  return stubApi(
    on('GET', '/api/v1/time-summaries', respond),
    on('GET', '/api/v1/time-balances', () => ({ status: 200, body: { data: timeBalances() } })),
  );
}

const byGroup = (call: ApiCall) => ({
  status: 200,
  body: { data: call.search.get('groupBy') === 'month' ? [october] : weeks },
});

function renderSummary(props: Partial<HoursSummaryProps> = {}) {
  const onSearchChange = vi.fn();
  renderWithApi(
    <HoursSummary search={{}} today={TODAY} onSearchChange={onSearchChange} {...props} />,
  );
  return { onSearchChange };
}

let saved: { name: string; blob: Blob } | null = null;

beforeEach(() => {
  saved = null;
  let pending: Blob | null = null;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    pending = blob;
    return 'blob:summary';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    if (pending) saved = { name: this.download, blob: pending };
  });
});

afterEach(() => {
  act(() => dismissToast());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HoursSummary', () => {
  it('shows this month by week by default, with a row per week and a totals row', async () => {
    const { calls } = stubSummaries(byGroup);
    renderSummary();

    expect(screen.getByRole('heading', { level: 1, name: 'Hours summary' })).toBeInTheDocument();
    expect(screen.getByText('Thu 1 Oct 2026 to Sat 31 Oct 2026, by week')).toBeInTheDocument();
    const table = await screen.findByRole('table', {
      name: 'Hours by week, Thu 1 Oct 2026 to Sat 31 Oct 2026',
    });
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      'Week',
      'Target',
      'Credited',
      'Worked',
      'Leave',
      'Bank holidays',
      'Flexi',
      'Converted',
      'TOIL',
      'TOIL taken',
      'TOIL unused',
      'Overtime paid',
      'Overtime unpaid',
      'Flexi balance at end',
    ]);
    const example = within(table).getByRole('row', { name: /Week of 5 Oct 2026/ });
    const cells = within(example)
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells.slice(0, 13)).toEqual([
      '37:30',
      '40:30',
      '40:30',
      '0:00',
      '0:00',
      '0:00',
      '3:00',
      '1:00',
      '0:00',
      '0:00',
      '0:00',
      '2:00',
      '+3:12 over',
    ]);
    const first = within(table).getByRole('row', { name: /^Week of 28 Sep 2026/ });
    expect(within(first).getByText('−2:10 under')).toBeInTheDocument();
    // Its warnings, as badges with text, in a row of their own under it.
    const warnings = within(table).getByRole('row', { name: /^Warnings for Week of 28 Sep 2026/ });
    expect(within(warnings).getByText('Day not recorded')).toBeInTheDocument();
    expect(within(warnings).getByText('Below minimum (2)')).toBeInTheDocument();
    expect(
      within(table).queryByRole('row', { name: /^Warnings for Week of 5 Oct 2026/ }),
    ).not.toBeInTheDocument();

    const total = within(table).getByRole('row', { name: /^Total/ });
    expect(within(total).getAllByRole('cell')[2]?.textContent).toBe('75:50');
    // Whole weeks are shown, and the table says so.
    expect(table).toHaveAccessibleDescription(
      'Weeks are shown whole, so the table covers Mon 28 Sep 2026 to Sun 11 Oct 2026.',
    );

    const summary = calls.find((call) => call.path === '/api/v1/time-summaries');
    expect(Object.fromEntries(summary?.search ?? [])).toEqual({
      from: '2026-10-01',
      to: '2026-11-01',
      groupBy: 'week',
      asOf: TODAY,
    });
  });

  it('groups by month from the URL, and changes grouping through the URL', async () => {
    const user = userEvent.setup();
    stubSummaries(byGroup);
    const { onSearchChange } = renderSummary({
      search: { from: '2026-10-01', to: '2026-10-31', groupBy: 'month' },
    });

    const table = await screen.findByRole('table', { name: /Hours by month/ });
    expect(within(table).getByRole('rowheader', { name: 'October 2026' })).toBeInTheDocument();
    expect(within(table).queryByRole('columnheader', { name: 'Week' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Group by'), 'week');
    expect(onSearchChange).toHaveBeenCalledWith({
      from: '2026-10-01',
      to: '2026-10-31',
      groupBy: 'week',
    });
  });

  it('never shows weeks as months while a new grouping loads (regression)', async () => {
    const user = userEvent.setup();
    stubSummaries(byGroup);
    // Hold the month request until the test lets it go.
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const stubbed = globalThis.fetch;
    vi.stubGlobal('fetch', async (request: Request) => {
      if (new URL(request.url).searchParams.get('groupBy') === 'month') await gate;
      return stubbed(request);
    });
    function Harness() {
      const [search, setSearch] = React.useState<Partial<SummarySearch>>({});
      return <HoursSummary search={search} today={TODAY} onSearchChange={setSearch} />;
    }
    renderWithApi(<Harness />);
    await screen.findByRole('table', { name: /Hours by week/ });

    await user.selectOptions(screen.getByLabelText('Group by'), 'month');
    // The week rows are gone at once: they are not relabelled as months.
    expect(screen.queryByRole('rowheader', { name: 'September 2026' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    release();
    const table = await screen.findByRole('table', { name: /Hours by month/ });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['October 2026', 'Total']);
  });

  it('writes each preset range to the URL', async () => {
    const user = userEvent.setup();
    stubSummaries(byGroup);
    const { onSearchChange } = renderSummary();
    const dates = screen.getByLabelText('Dates');
    expect(dates).toHaveValue('this-month');

    await user.selectOptions(dates, 'last-month');
    expect(onSearchChange).toHaveBeenLastCalledWith({
      from: '2026-09-01',
      to: '2026-09-30',
      groupBy: 'week',
    });
    await user.selectOptions(dates, 'this-year');
    expect(onSearchChange).toHaveBeenLastCalledWith({
      from: '2026-01-01',
      to: '2026-12-31',
      groupBy: 'week',
    });
  });

  it('shows custom dates for a range no preset matches, and applies new ones', async () => {
    const user = userEvent.setup();
    stubSummaries(byGroup);
    const { onSearchChange } = renderSummary({
      search: { from: '2026-10-05', to: '2026-10-11', groupBy: 'week' },
    });

    expect(screen.getByLabelText('Dates')).toHaveValue('custom');
    const form = screen.getByRole('form', { name: 'Custom dates' });
    expect(within(form).getByLabelText('From')).toHaveValue('2026-10-05');
    const to = within(form).getByLabelText('To');
    await user.clear(to);
    await user.type(to, '2026-10-18');
    await user.click(within(form).getByRole('button', { name: 'Show these dates' }));
    expect(onSearchChange).toHaveBeenCalledWith({
      from: '2026-10-05',
      to: '2026-10-18',
      groupBy: 'week',
    });
  });

  it('refuses a custom range over 366 days before asking the API', async () => {
    const user = userEvent.setup();
    stubSummaries(byGroup);
    const { onSearchChange } = renderSummary();

    await user.selectOptions(screen.getByLabelText('Dates'), 'custom');
    const form = screen.getByRole('form', { name: 'Custom dates' });
    const from = within(form).getByLabelText('From');
    await user.clear(from);
    await user.type(from, '2025-01-01');
    await user.click(within(form).getByRole('button', { name: 'Show these dates' }));

    const to = within(form).getByLabelText('To');
    expect(to).toHaveAttribute('aria-invalid', 'true');
    expect(to).toHaveAccessibleDescription('Choose a range of 366 days or fewer.');
    expect(onSearchChange).not.toHaveBeenCalled();
  });

  it('explains a range from the URL that is too long, without asking the API', async () => {
    const { calls } = stubSummaries(byGroup);
    renderSummary({ search: { from: '2025-01-01', to: '2026-10-31' } });
    expect(await screen.findByText('Choose a range of 366 days or fewer.')).toBeInTheDocument();
    expect(calls.some((call) => call.path === '/api/v1/time-summaries')).toBe(false);
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  });

  it("shows the API's 422 for a range it refuses", async () => {
    stubSummaries(() => ({
      status: 422,
      body: {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The range is too long.',
          details: ['the range must be at most 366 days'],
        },
      },
    }));
    renderSummary();
    expect(await screen.findByText('The range is too long.')).toBeInTheDocument();
    expect(screen.getByText(/the range must be at most 366 days/)).toBeInTheDocument();
  });

  it('says when nothing was recorded between the dates', async () => {
    stubSummaries(() => ({
      status: 200,
      body: {
        data: [summaryGroup({ creditedMinutes: 0, workedMinutes: 0, conversion: 'OFF' })],
      },
    }));
    renderSummary();
    expect(await screen.findByText('No time recorded between these dates.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeDisabled();
  });

  it('offers Retry when the summary fails to load', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubSummaries((call) =>
      fail
        ? { status: 500, body: { error: { code: 'INTERNAL', message: 'Boom.' } } }
        : byGroup(call),
    );
    renderSummary();
    expect(await screen.findByText("We couldn't load the summary.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it("shows the leave year of the range's end", async () => {
    const { calls } = stubSummaries(byGroup);
    renderSummary();
    const strip = await screen.findByRole('region', { name: 'Leave year 2026' });
    expect(await within(strip).findByText('247:30')).toBeInTheDocument();
    expect(within(strip).getByText('127:30')).toBeInTheDocument();
    expect(within(strip).getByText('120:00')).toBeInTheDocument();
    expect(calls.find((call) => call.path === '/api/v1/time-balances')?.search.get('asOf')).toBe(
      '2026-12-31',
    );
  });

  it('downloads the rows shown as CSV, named for the range', async () => {
    const user = userEvent.setup();
    stubSummaries(byGroup);
    renderSummary();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(saved?.name).toBe('hours-summary-2026-10-01-2026-10-31.csv');
    const text = (await saved?.blob.text()) ?? '';
    const lines = text.replace(/^\uFEFF/, '').split('\r\n');
    expect(lines[0]).toMatch(/^Week,From,To,Target \(h:mm\),Target \(hours\),/);
    expect(lines[2]).toMatch(/^Week of 5 Oct 2026,2026-10-05,2026-10-11,37:30,37.5,40:30,40.5,/);
    expect(lines[3]).toMatch(/^Total,2026-09-28,2026-10-11,/);
    expect(saved?.blob.type).toBe('text/csv;charset=utf-8');
  });
});
