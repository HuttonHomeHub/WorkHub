import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { E2E_WEEK_USER } from './fixtures';
import { listAll, signIn, type Row } from './support';

/**
 * A screenshot pass for design review (docs/features/app-shell-refresh.md):
 * every hours screen at 1280×800 and 1920×1080, in light and dark, saved to
 * `E2E_SCREENSHOT_DIR`. The images are for a person to look at; they are not
 * golden images and nothing compares them. Skipped unless the variable is set.
 *
 * It seeds realistic weeks of its own through the API: three weeks of March
 * and April 2026 for the week journeys' account, with the conversion on, the
 * Easter bank holidays, a day of leave and a night shift, and the browser's
 * clock on Wednesday 8 April 2026.
 */
const DIR = process.env.E2E_SCREENSHOT_DIR;
test.skip(!DIR, 'Set E2E_SCREENSHOT_DIR to take the design-review screenshots');
test.describe.configure({ mode: 'serial' });

const API = '/api/v1';
const NOW = new Date('2026-04-08T11:00:00Z');
const RANGE = 'from=2026-03-23&to=2026-04-13';

/** Local (BST from 29 March) start and end, as the API's UTC instants. */
function instant(date: string, time: string, nextDay = false): string {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const at = new Date(`${date}T00:00:00Z`);
  if (nextDay) at.setUTCDate(at.getUTCDate() + 1);
  const offset = date >= '2026-03-29' ? 1 : 0;
  at.setUTCHours(hours - offset, minutes);
  return at.toISOString();
}

type Day = [
  date: string,
  start: string | null,
  end: string | null,
  breakMinutes: number,
  leave?: number,
];

const DAYS: Day[] = [
  ['2026-03-23', '08:00', '17:00', 30],
  ['2026-03-24', '07:30', '16:45', 30],
  ['2026-03-25', null, null, 0, 450],
  ['2026-03-26', '22:00', '06:30', 30],
  ['2026-03-27', '08:00', '14:00', 0],
  ['2026-03-30', '08:00', '17:30', 30],
  ['2026-03-31', '06:45', '16:30', 30],
  ['2026-04-01', '08:00', '16:30', 30],
  ['2026-04-02', '08:00', '15:00', 30],
  ['2026-04-07', '07:30', '18:15', 30],
];

async function seed(request: APIRequestContext): Promise<void> {
  const terms = await request.post(`${API}/work-terms`, { data: { effectiveFrom: '2026-01-05' } });
  expect([201, 409]).toContain(terms.status());
  expect((await request.post(`${API}/public-holiday-imports`, { data: { year: 2026 } })).ok()).toBe(
    true,
  );
  for (const day of await listAll<Row>(request, `${API}/work-days?${RANGE}`)) {
    await request.delete(`${API}/work-days/${day.id}`);
  }
  for (const row of await listAll<Row>(request, `${API}/excess-conversions?${RANGE}`)) {
    await request.delete(`${API}/excess-conversions/${row.id}`);
  }
  for (const [date, start, end, breakMinutes, leave = 0] of DAYS) {
    const response = await request.post(`${API}/work-days`, {
      data: {
        date,
        startsAt: start ? instant(date, start) : null,
        endsAt: end ? instant(date, end, start !== null && end < start) : null,
        breakMinutes,
        leaveMinutes: leave,
        toilTakenMinutes: 0,
        bankHolidayWorked: false,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  }
  for (const weekStart of ['2026-03-23', '2026-03-30', '2026-04-06']) {
    const response = await request.post(`${API}/excess-conversions`, { data: { weekStart } });
    expect(response.status()).toBe(201);
  }
}

const SCREENS: [name: string, path: string, ready: (page: Page) => Promise<void>][] = [
  [
    'week',
    '/hours?week=2026-04-06',
    (page) => expect(page.getByRole('region', { name: 'Balances' })).toContainText('Flexi'),
  ],
  [
    'week-bank-holiday',
    '/hours?week=2026-03-30',
    (page) => expect(page.getByRole('region', { name: 'Balances' })).toContainText('Flexi'),
  ],
  [
    'week-night-shift',
    '/hours?week=2026-03-23',
    (page) => expect(page.getByRole('region', { name: 'Balances' })).toContainText('Flexi'),
  ],
  [
    'summary-weeks',
    '/hours/summary?from=2026-03-01&to=2026-04-30&groupBy=week',
    (page) => expect(page.getByRole('table')).toBeVisible(),
  ],
  [
    'summary-months',
    '/hours/summary?from=2026-01-01&to=2026-12-31&groupBy=month',
    (page) => expect(page.getByRole('table')).toBeVisible(),
  ],
  [
    'settings-terms',
    '/hours/settings?tab=terms',
    (page) => expect(page.getByRole('form', { name: 'New terms' })).toBeVisible(),
  ],
  [
    'settings-leave',
    '/hours/settings?tab=leave',
    (page) => expect(page.getByRole('heading', { name: 'Leave years' })).toBeVisible(),
  ],
  [
    'settings-balances',
    '/hours/settings?tab=balances',
    (page) => expect(page.getByRole('heading', { name: 'Balance adjustments' })).toBeVisible(),
  ],
  [
    'settings-holidays',
    '/hours/settings?tab=holidays&year=2026',
    (page) => expect(page.getByRole('table')).toBeVisible(),
  ],
];

test('seeds the review data', async ({ page }) => {
  await signIn(page, E2E_WEEK_USER);
  await seed(page.request);
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`every hours screen at ${String(viewport.width)} in ${colorScheme}`, async ({ page }) => {
      mkdirSync(DIR!, { recursive: true });
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.clock.setFixedTime(NOW);
      await signIn(page, E2E_WEEK_USER);
      for (const [name, path, ready] of SCREENS) {
        await page.goto(path);
        await ready(page);
        await page.screenshot({
          path: join(DIR!, `${name}-${String(viewport.width)}-${colorScheme}.png`),
          fullPage: true,
        });
      }
    });
  }
}
