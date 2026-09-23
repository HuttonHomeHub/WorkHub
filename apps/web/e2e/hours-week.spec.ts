import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { E2E_WEEK_USER } from './fixtures';
import {
  expectNoA11yViolations,
  expectNoPageHorizontalScroll,
  listAll,
  signIn,
  tabTo,
  toast,
  type Row,
} from './support';

/**
 * The hours week view (hours tracker slice 7): the keyboard-only journey —
 * enter a week, a night shift and leave, clear a day and undo, and the
 * unsaved-changes guard — with axe at 1280×800 and reflow at 320 CSS px, and
 * the sidebar's Hours entry.
 *
 * The journeys use their own account (`E2E_WEEK_USER`), whose terms start on
 * a past Monday, so every day of the journey week is in the past and counts.
 * Each journey resets that week through the API first.
 */
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1280, height: 800 } });

const API = '/api/v1';
/** The account's tracking start (a Monday). */
const TRACKING_START = '2026-01-05';
/** The journey's week: Monday 2 February 2026. */
const WEEK = '2026-02-02';

async function resetWeek(request: APIRequestContext): Promise<void> {
  const terms = await request.post(`${API}/work-terms`, {
    data: { effectiveFrom: TRACKING_START },
  });
  // 201 created, or 409: they already exist.
  expect([201, 409]).toContain(terms.status());
  const days = await listAll<Row>(request, `${API}/work-days?from=${WEEK}&to=2026-02-09`);
  for (const day of days) await request.delete(`${API}/work-days/${day.id}`);
  const switches = await listAll<Row>(
    request,
    `${API}/excess-conversions?from=${WEEK}&to=2026-02-03`,
  );
  for (const row of switches) await request.delete(`${API}/excess-conversions/${row.id}`);
}

function field(page: Page, name: string, day: string) {
  return page.getByRole('textbox', { name: `${name}, ${day}`, exact: true });
}

function row(page: Page, day: string) {
  return page.getByRole('row', { name: new RegExp(`^${day}`) });
}

/** Types into the focused field, replacing what is there. */
async function typeInto(page: Page, text: string): Promise<void> {
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(text);
}

test('opens on a Monday in the URL, and the sidebar marks Hours as current', async ({ page }) => {
  await signIn(page, E2E_WEEK_USER);
  await resetWeek(page.request);

  const hours = page
    .getByRole('navigation', { name: 'Tools' })
    .getByRole('link', { name: 'Hours' });
  await hours.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Hours' })).toBeVisible();
  await expect(hours).toHaveAttribute('aria-current', 'page');
  // No week in the URL: this week's Monday is put there.
  await expect(page).toHaveURL(/\/hours\?week=\d{4}-\d{2}-\d{2}$/);
  const monday = new URL(page.url()).searchParams.get('week') ?? '';
  expect(new Date(`${monday}T00:00:00Z`).getUTCDay()).toBe(1);
  await expect(page.getByRole('row', { name: /Today/ })).toBeVisible();

  // Any other date becomes its Monday.
  await page.goto('/hours?week=2026-02-05');
  await expect(page).toHaveURL(/week=2026-02-02$/);
  await expect(page.getByRole('heading', { name: 'Week of 2 Feb 2026' })).toBeVisible();
  await expect(page.getByText('No time recorded this week.')).toBeVisible();
  await expectNoA11yViolations(page);

  // The navigator moves by a week, and back restores the week.
  await page.getByRole('button', { name: 'Next week' }).click();
  await expect(page).toHaveURL(/week=2026-02-09$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Week of 2 Feb 2026' })).toBeVisible();

  // Before the tracking start.
  await page.goto('/hours?week=2025-12-29');
  await expect(page.getByText('Tracking starts on Mon 5 Jan 2026.')).toBeVisible();
  await expectNoA11yViolations(page);
});

test('enters a week from the keyboard, clears a day and undoes it', async ({ page }) => {
  await signIn(page, E2E_WEEK_USER);
  await resetWeek(page.request);
  await page.goto(`/hours?week=${WEEK}`);
  await expect(page.getByRole('heading', { name: 'Week of 2 Feb 2026' })).toBeVisible();

  // Monday: a day with a break; Enter saves the row.
  await tabTo(page, field(page, 'Start', 'Mon 2 Feb'));
  await page.keyboard.type('0800');
  await page.keyboard.press('Tab');
  await expect(field(page, 'Start', 'Mon 2 Feb')).toHaveValue('08:00');
  await page.keyboard.type('1730');
  await expect(row(page, 'Mon 2 Feb')).toContainText('Unsaved');
  await page.keyboard.press('Tab');
  await page.keyboard.type('30m');
  // Live, before saving.
  await expect(row(page, 'Mon 2 Feb')).toContainText('+1:30 over');
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Mon 2 Feb saved')).toBeVisible();
  await expect(row(page, 'Mon 2 Feb')).not.toContainText('Unsaved');
  await expect(row(page, 'Mon 2 Feb')).toContainText('9:00');

  // Tuesday: no break recorded, so the minimum is deducted (a note).
  await tabTo(page, field(page, 'Start', 'Tue 3 Feb'));
  await page.keyboard.type('830');
  await page.keyboard.press('Tab');
  await page.keyboard.type('17');
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Tue 3 Feb saved')).toBeVisible();
  await expect(row(page, 'Tue 3 Feb')).toContainText('8:00');
  await expect(row(page, 'Tue 3 Feb')).toContainText('Break raised to 0:30');

  // Wednesday: a night shift, shown as ending the next day.
  await tabTo(page, field(page, 'Start', 'Wed 4 Feb'));
  await page.keyboard.type('2200');
  await page.keyboard.press('Tab');
  await page.keyboard.type('0600');
  await page.keyboard.press('Tab');
  await expect(row(page, 'Wed 4 Feb')).toContainText('+1 day');
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Wed 4 Feb saved')).toBeVisible();
  await expect(row(page, 'Wed 4 Feb')).toContainText('7:30');
  await expect(row(page, 'Wed 4 Feb')).toContainText('After 19:00');

  // Thursday: a day of leave.
  await tabTo(page, field(page, 'Leave', 'Thu 5 Feb'));
  await page.keyboard.type('7.5h');
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Thu 5 Feb saved')).toBeVisible();
  await expect(field(page, 'Leave', 'Thu 5 Feb')).toHaveValue('7:30');

  // Friday has nothing: it warns, and the week's totals say so.
  await expect(row(page, 'Fri 6 Feb')).toContainText('Nothing recorded');
  const totals = page.getByRole('row', { name: /^Week/ });
  await expect(totals).toContainText('32:00 of 37:30 target');
  await expect(totals).toContainText('−5:30 under');
  await expectNoA11yViolations(page);

  // Clear Tuesday from its row menu; focus moves to the next row.
  await tabTo(page, page.getByRole('button', { name: 'Actions for Tue 3 Feb' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Clear day' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Day cleared')).toBeVisible();
  await expect(field(page, 'Start', 'Wed 4 Feb')).toBeFocused();
  await expect(field(page, 'Start', 'Tue 3 Feb')).toHaveValue('');

  // Undo, reached by Tab.
  await tabTo(
    page,
    page.getByRole('region', { name: 'Notifications' }).getByRole('button', { name: 'Undo' }),
  );
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Tue 3 Feb restored')).toBeVisible();
  await expect(field(page, 'Start', 'Tue 3 Feb')).toHaveValue('08:30');

  // An unsaved row: leaving asks first, Esc keeps editing, and Esc in the row reverts it.
  await field(page, 'Start', 'Fri 6 Feb').focus();
  await typeInto(page, '9');
  await page.getByRole('button', { name: 'Previous week' }).focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'Discard changes?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Previous week' })).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`week=${WEEK}$`));
  await field(page, 'Start', 'Fri 6 Feb').focus();
  await expect(field(page, 'Start', 'Fri 6 Feb')).toHaveValue('09:00');
  await page.keyboard.press('Escape');
  await expect(field(page, 'Start', 'Fri 6 Feb')).toHaveValue('');
  await expect(row(page, 'Fri 6 Feb')).not.toContainText('Unsaved');

  // Reload keeps the week and what was saved.
  await page.reload();
  await expect(field(page, 'End', 'Wed 4 Feb')).toHaveValue('06:00');
  await expect(row(page, 'Wed 4 Feb')).toContainText('+1 day');
});

test('passes axe in the dark theme, with warnings and a row menu open', async ({ page }) => {
  await signIn(page, E2E_WEEK_USER);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(`/hours?week=${WEEK}`);
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(row(page, 'Fri 6 Feb')).toContainText('Nothing recorded');
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Actions for Mon 2 Feb' }).click();
  await expect(page.getByRole('menuitem', { name: 'Clear day' })).toBeVisible();
  await expectNoA11yViolations(page);
});

test('reflows at the 320 CSS px floor (1280×800 at 400% zoom)', async ({ page }) => {
  await signIn(page, E2E_WEEK_USER);
  await page.goto(`/hours?week=${WEEK}`);
  await expect(page.getByRole('heading', { name: 'Week of 2 Feb 2026' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 200 });
  await expect(field(page, 'Start', 'Mon 2 Feb')).toBeAttached();
  await expectNoPageHorizontalScroll(page);
  await expectNoA11yViolations(page);
});
