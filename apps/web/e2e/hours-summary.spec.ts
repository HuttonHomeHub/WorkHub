import { readFile } from 'node:fs/promises';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { expectNoA11yViolations, signIn } from './support';

/**
 * The hours summary journeys (hours tracker slice 10): reading the summary by
 * week and by month, a preset, and downloading the CSV, with axe in light and
 * dark at 1280×800, and reflowed at 320 CSS px (400% zoom).
 *
 * The journey account persists between runs and other journeys share it, so
 * these work in October 2088, which no other journey uses: their own terms
 * from Monday 27 September 2088, the feature doc's worked example in the week
 * of Monday 4 October (its conversion switched on), and a browser clock set
 * to 15 November 2088, so October has ended and the conversion has settled.
 * Each run resets that month's days and switches through the API first.
 *
 * 2088 is before every other journey's terms (the settings journeys' start in
 * December 2089), so these terms are never the latest, which the settings
 * journeys edit, and no later terms change the ones in force here.
 */
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1280, height: 800 } });

const API = '/api/v1';
const TERMS_FROM = '2088-09-27';
const WEEK = '2088-10-04';
/** Noon on Mon 15 Nov 2088 in London: October 2088 has ended. */
const NOW = new Date('2088-11-15T12:00:00Z');

/** The worked example's days, as UTC instants (London is on BST, UTC+1). */
const EXAMPLE_DAYS = [
  { date: '2088-10-04', startsAt: '07:00', endsAt: '16:30', breakMinutes: 30 },
  { date: '2088-10-05', startsAt: '06:30', endsAt: '17:00', breakMinutes: 30 },
  { date: '2088-10-06', startsAt: '07:00', endsAt: '15:00', breakMinutes: 30 },
  { date: '2088-10-07', startsAt: '07:00', endsAt: '16:00', breakMinutes: 15 },
  { date: '2088-10-08', startsAt: '07:00', endsAt: '12:30', breakMinutes: 0 },
];

async function listData<T>(request: APIRequestContext, path: string): Promise<T[]> {
  const response = await request.get(path);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { data: T[] }).data;
}

/** Terms from 27 Sep 2088, October's days as the worked example, and its switch on. */
async function seedOctober(request: APIRequestContext): Promise<void> {
  const terms = await request.post(`${API}/work-terms`, { data: { effectiveFrom: TERMS_FROM } });
  // 201 created, or 409: an earlier run made them.
  expect([201, 409]).toContain(terms.status());

  const range = 'from=2088-09-27&to=2088-11-01&limit=100';
  for (const day of await listData<{ id: string }>(request, `${API}/work-days?${range}`)) {
    expect((await request.delete(`${API}/work-days/${day.id}`)).ok()).toBe(true);
  }
  for (const row of await listData<{ id: string }>(request, `${API}/excess-conversions?${range}`)) {
    expect((await request.delete(`${API}/excess-conversions/${row.id}`)).ok()).toBe(true);
  }
  for (const day of EXAMPLE_DAYS) {
    const response = await request.post(`${API}/work-days`, {
      data: {
        date: day.date,
        startsAt: `${day.date}T${day.startsAt}:00.000Z`,
        endsAt: `${day.date}T${day.endsAt}:00.000Z`,
        breakMinutes: day.breakMinutes,
        leaveMinutes: 0,
        toilTakenMinutes: 0,
        bankHolidayWorked: false,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  }
  const conversion = await request.post(`${API}/excess-conversions`, {
    data: { weekStart: WEEK },
  });
  expect(conversion.status()).toBe(201);
}

async function openSummary(page: Page, search: string): Promise<void> {
  await page.clock.setFixedTime(NOW);
  await page.goto(`/hours/summary${search}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Hours summary' })).toBeVisible();
}

/** The text of each figure cell in a row, in column order. */
async function cells(page: Page, row: string): Promise<string[]> {
  return page
    .getByRole('row', { name: new RegExp(`^${row}`) })
    .getByRole('cell')
    .allInnerTexts();
}

async function expectNoPageHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await seedOctober(page.request);
});

test('reads October by week, then by month, and back', async ({ page }) => {
  await openSummary(page, '?from=2088-10-01&to=2088-10-31');
  const table = page.getByRole('table', { name: /^Hours by week/ });
  await expect(table).toBeVisible();
  // October is last month on the browser's clock, so the preset shows.
  await expect(page.getByLabel('Dates')).toHaveValue('last-month');

  // The worked example, settled: 3:00 converted, all of it TOIL (the cap is 7:30).
  const example = await cells(page, 'Week of 4 Oct 2088');
  expect(example.slice(0, 12)).toEqual([
    '37:30',
    '40:30',
    '40:30',
    '0:00',
    '0:00',
    '0:00',
    '3:00',
    '3:00',
    '0:00',
    '0:00',
    '0:00',
    '0:00',
  ]);
  // The other weeks were never recorded, and say so with text.
  await expect(
    page
      .getByRole('row', { name: /^Warnings for Week of 11 Oct 2088/ })
      .getByText('Day not recorded (5)'),
  ).toBeVisible();
  // October's unused TOIL becomes unpaid overtime on its last day (rule 8).
  const lastWeek = await cells(page, 'Week of 25 Oct 2088');
  expect(lastWeek[9]).toBe('3:00');
  expect(lastWeek[11]).toBe('3:00');
  await expect(page.getByRole('region', { name: 'Leave year 2088' })).toContainText('Allowance');
  await expectNoA11yViolations(page);

  await page.getByLabel('Group by').selectOption('month');
  await expect(page).toHaveURL(/groupBy=month/);
  await expect(page.getByRole('table', { name: /^Hours by month/ })).toBeVisible();
  const month = await cells(page, 'October 2088');
  // 21 working days of 7:30; the example's 40:30; its 3:00 TOIL unused, so overtime.
  expect(month.slice(0, 3)).toEqual(['157:30', '40:30', '40:30']);
  expect(month.slice(6, 12)).toEqual(['3:00', '3:00', '0:00', '3:00', '0:00', '3:00']);
  await expectNoA11yViolations(page);

  // Back undoes the grouping, and a reload keeps the view.
  await page.goBack();
  await expect(page.getByRole('table', { name: /^Hours by week/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('table', { name: /^Hours by week/ })).toBeVisible();
  await expect(page.getByLabel('Group by')).toHaveValue('week');
});

test('opens on this month, and a preset moves the range in the URL', async ({ page }) => {
  await openSummary(page, '');
  await expect(page.getByLabel('Dates')).toHaveValue('this-month');
  await expect(page.getByText('Mon 1 Nov 2088 to Tue 30 Nov 2088, by week')).toBeVisible();

  await page.getByLabel('Dates').selectOption('last-month');
  await expect(page).toHaveURL(/from=2088-10-01&to=2088-10-31/);
  await expect(page.getByRole('row', { name: /^Week of 4 Oct 2088/ })).toBeVisible();

  // Custom dates: a range over 366 days is refused before it is sent.
  await page.getByLabel('Dates').selectOption('custom');
  const form = page.getByRole('form', { name: 'Custom dates' });
  await form.getByLabel('From').fill('2087-01-01');
  await form.getByRole('button', { name: 'Show these dates' }).click();
  await expect(form.getByText('Choose a range of 366 days or fewer.')).toBeVisible();
  await expect(page).toHaveURL(/from=2088-10-01/);
  await expectNoA11yViolations(page);

  await form.getByLabel('From').fill('2088-10-04');
  await form.getByLabel('To').fill('2088-10-10');
  await form.getByRole('button', { name: 'Show these dates' }).click();
  await expect(page).toHaveURL(/from=2088-10-04&to=2088-10-10/);
  await expect(page.getByRole('row', { name: /^Week of 4 Oct 2088/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /^Week of 11 Oct 2088/ })).toHaveCount(0);
});

test('downloads the summary as CSV', async ({ page }) => {
  await openSummary(page, '?from=2088-10-01&to=2088-10-31&groupBy=month');
  await expect(page.getByRole('table', { name: /^Hours by month/ })).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('hours-summary-2088-10-01-2088-10-31.csv');
  const text = await readFile(await download.path(), 'utf8');
  const lines = text.replace(/^\uFEFF/, '').split('\r\n');
  expect(lines[0]).toMatch(/^Month,From,To,Target \(h:mm\),Target \(hours\),/);
  expect(lines[1]).toMatch(/^October 2088,2088-10-01,2088-10-31,157:30,157.5,40:30,40.5,/);
  expect(lines[2]).toMatch(/^Total,/);
});

test('passes axe in the dark theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await openSummary(page, '?from=2088-10-01&to=2088-10-31');
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(page.getByRole('table', { name: /^Hours by week/ })).toBeVisible();
  await expectNoA11yViolations(page);
});

test.describe('at the 320 CSS px reflow floor (1280×800 at 400% zoom)', () => {
  test('the summary reflows, and only the table scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 200 });
    await openSummary(page, '?from=2088-10-01&to=2088-10-31');
    const region = page.getByRole('region', { name: /^Hours by week/ });
    await expect(region).toBeVisible();
    await expectNoPageHorizontalScroll(page);
    // The table scrolls inside its own region, which the keyboard can reach.
    expect(await region.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await region.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => region.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
