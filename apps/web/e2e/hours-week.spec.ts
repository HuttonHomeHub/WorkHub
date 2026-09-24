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

/** A day's warnings and notes, in a row of their own under the day's row. */
function notes(page: Page, day: string) {
  return page.getByRole('row', { name: new RegExp(`^(Warnings|Notes) for ${day}:`) });
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
  await expect(notes(page, 'Tue 3 Feb')).toContainText('Note: Break raised to 0:30');

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
  await expect(notes(page, 'Wed 4 Feb')).toContainText('Warning: After 19:00');

  // Thursday: a day of leave.
  await tabTo(page, field(page, 'Leave', 'Thu 5 Feb'));
  await page.keyboard.type('7.5h');
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Thu 5 Feb saved')).toBeVisible();
  await expect(field(page, 'Leave', 'Thu 5 Feb')).toHaveValue('7:30');

  // Friday has nothing: it warns, and the week's totals say so.
  await expect(notes(page, 'Fri 6 Feb')).toContainText('Nothing recorded');
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

test('opens the row menu from the keyboard with Shift+F10, and Esc returns focus', async ({
  page,
}) => {
  await signIn(page, E2E_WEEK_USER);
  await page.goto(`/hours?week=${WEEK}`);
  // Monday was saved by the journey above, so its row has actions.
  const actions = page.getByRole('button', { name: 'Actions for Mon 2 Feb' });
  await expect(actions).toBeEnabled();
  await actions.focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.getByRole('menu', { name: 'Actions for Mon 2 Feb' });
  await expect(menu.getByRole('menuitem', { name: 'Clear day' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(actions).toBeFocused();
  await expect(field(page, 'Start', 'Mon 2 Feb')).toHaveValue('08:00');
});

test('passes axe in the dark theme, with warnings and a row menu open', async ({ page }) => {
  await signIn(page, E2E_WEEK_USER);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(`/hours?week=${WEEK}`);
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(notes(page, 'Fri 6 Feb')).toContainText('Nothing recorded');
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

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]) {
  test(`lays the aside beside the table at ${String(viewport.width)}×${String(viewport.height)}, with no scroll`, async ({
    page,
  }) => {
    await layoutCheck(page, viewport);
  });
}

test('keeps every time readable with WCAG 1.4.12 text spacing', async ({ page }) => {
  await page.clock.setFixedTime(BEFORE_SETTLEMENT);
  await signIn(page, E2E_WEEK_USER);
  await seedExampleWeek(page.request, true);
  await page.goto(`/hours?week=${EXAMPLE_WEEK}`);
  await expect(field(page, 'Start', 'Mon 5 Oct')).toHaveValue('08:00');
  // The success criterion's spacing: nothing may clip or overlap.
  await page.addStyleTag({
    content: `* {
      line-height: 1.5 !important;
      letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important;
    }
    p { margin-bottom: 2em !important; }`,
  });
  const clipped = await page
    .getByRole('table', { name: 'Week of 5 Oct 2026' })
    .evaluate((table) =>
      [...table.querySelectorAll('input')]
        .filter((input) => input.scrollWidth > input.clientWidth)
        .map((input) => `${input.getAttribute('aria-label') ?? ''} "${input.value}"`),
    );
  expect(clipped).toEqual([]);
});

/**
 * The aside sits beside the table, and the table fits its column: no page
 * scroll and no table scroll, with the conversion's column showing and a row
 * being edited (its Save button showing), the widest the table gets.
 */
async function layoutCheck(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.clock.setFixedTime(BEFORE_SETTLEMENT);
  await signIn(page, E2E_WEEK_USER);
  await seedExampleWeek(page.request, true);
  await page.goto(`/hours?week=${EXAMPLE_WEEK}`);
  await expect(page.getByRole('columnheader', { name: 'Converted (preview)' })).toBeVisible();
  await field(page, 'Start', 'Thu 8 Oct').fill('0900');
  await expect(row(page, 'Thu 8 Oct')).toContainText('Unsaved');
  const table = page.getByRole('table', { name: 'Week of 5 Oct 2026' });
  const aside = page.getByRole('complementary', { name: 'This week and balances' });
  await expect(aside.getByRole('region', { name: 'TOIL and overtime' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Headline figures' })).toBeVisible();
  await expect(table).toBeVisible();
  await expect(field(page, 'Start', 'Mon 5 Oct')).toBeVisible();
  const tableBox = (await table.boundingBox())!;
  const asideBox = (await aside.boundingBox())!;
  // Beside, not below: to the right of the table and starting level with it.
  expect(asideBox.x).toBeGreaterThanOrEqual(tableBox.x + tableBox.width);
  expect(asideBox.y).toBeLessThan(tableBox.y + tableBox.height / 2);
  await expectNoPageHorizontalScroll(page);
  // The table fits without scrolling in its own region.
  expect(
    await table.evaluate(
      (element) => element.parentElement!.scrollWidth - element.parentElement!.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  // No empty band on a wide window: the card is sized to the table's needs and
  // the columns share its width, so the row menu's column stays narrow.
  const actions = page.getByRole('columnheader', { name: 'Actions' });
  // The row being edited shows Save beside the menu: the column holds just those.
  expect((await actions.boundingBox())!.width).toBeLessThanOrEqual(140);
  expect(asideBox.x - (tableBox.x + tableBox.width)).toBeLessThanOrEqual(24);
  await expectNoA11yViolations(page);
  // Esc reverts the edited row, so nothing is left to guard.
  await field(page, 'Start', 'Thu 8 Oct').focus();
  await page.keyboard.press('Escape');
  await expect(row(page, 'Thu 8 Oct')).not.toContainText('Unsaved');
}

/**
 * The aside's journeys work in the feature doc's worked example, the week of
 * Monday 5 October 2026, seeded through the API, with the browser's clock set
 * so the week is before or after its settlement on Friday 9 October.
 */
const EXAMPLE_WEEK = '2026-10-05';
/** Wed 7 Oct 2026, noon in London (BST): before the settlement day. */
const BEFORE_SETTLEMENT = new Date('2026-10-07T11:00:00Z');
/** Mon 12 Oct 2026, noon in London: the week has settled. */
const SETTLED = new Date('2026-10-12T11:00:00Z');
const SETTLED_DATE = '2026-10-12';

/** The worked example's days, as UTC instants (London is on BST, UTC+1). */
const EXAMPLE_DAYS = [
  { date: '2026-10-05', startsAt: '07:00', endsAt: '16:30', breakMinutes: 30 },
  { date: '2026-10-06', startsAt: '06:30', endsAt: '17:00', breakMinutes: 30 },
  { date: '2026-10-07', startsAt: '07:00', endsAt: '15:00', breakMinutes: 30 },
  { date: '2026-10-08', startsAt: '07:00', endsAt: '16:00', breakMinutes: 15 },
  { date: '2026-10-09', startsAt: '07:00', endsAt: '12:30', breakMinutes: 0 },
];

/** Resets the example week to the worked example, with its switch on or off. */
async function seedExampleWeek(request: APIRequestContext, switchOn: boolean): Promise<void> {
  const terms = await request.post(`${API}/work-terms`, {
    data: { effectiveFrom: TRACKING_START },
  });
  expect([201, 409]).toContain(terms.status());
  // All of October, so no other day of the month moves its TOIL.
  const range = 'from=2026-09-28&to=2026-11-02';
  for (const day of await listAll<Row>(request, `${API}/work-days?${range}`)) {
    expect((await request.delete(`${API}/work-days/${day.id}`)).ok()).toBe(true);
  }
  for (const row of await listAll<Row>(request, `${API}/excess-conversions?${range}`)) {
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
  if (switchOn) {
    const conversion = await request.post(`${API}/excess-conversions`, {
      data: { weekStart: EXAMPLE_WEEK },
    });
    expect(conversion.status()).toBe(201);
  }
}

/** `h:mm`, as the app writes durations. */
function hm(minutes: number): string {
  const sign = minutes < 0 ? '−' : '';
  const abs = Math.abs(minutes);
  return `${sign}${String(Math.floor(abs / 60))}:${String(abs % 60).padStart(2, '0')}`;
}

/** Signed flexi, as the app writes it: `+0:40 over`, `−2:00 under`, `0:00`. */
function flexi(minutes: number): string {
  if (minutes > 0) return `+${hm(minutes)} over`;
  if (minutes < 0) return `${hm(minutes)} under`;
  return '0:00';
}

function asideOf(page: Page) {
  return page.getByRole('complementary', { name: 'This week and balances' });
}

/** A figure in a headline tile or an aside panel, by its term. */
function figure(page: Page, term: string) {
  return page
    .getByRole('main')
    .getByRole('definition')
    .filter({
      has: page.locator('xpath=preceding-sibling::dt[1]', { hasText: new RegExp(`^${term}$`) }),
    });
}

test('switches conversion on and off: a preview before settlement, applied from it', async ({
  page,
}) => {
  await page.clock.setFixedTime(BEFORE_SETTLEMENT);
  await signIn(page, E2E_WEEK_USER);
  await seedExampleWeek(page.request, false);
  await page.goto(`/hours?week=${EXAMPLE_WEEK}`);
  const aside = asideOf(page);
  const toggle = aside.getByRole('switch', {
    name: "Convert this week's excess to TOIL and overtime",
  });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('columnheader', { name: /Converted/ })).toHaveCount(0);

  // On, from the keyboard: a preview until Friday, in the aside and the table.
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(aside.getByText('Saved', { exact: true })).toBeVisible();
  await expect(toggle).toBeFocused();
  await expect(aside).toContainText('Preview until Fri 9 Oct');
  await expect(page.getByRole('columnheader', { name: 'Converted (preview)' })).toBeVisible();
  await expectNoA11yViolations(page);

  // Off again: the switch is its own undo.
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('columnheader', { name: /Converted/ })).toHaveCount(0);
  await expect(aside).not.toContainText('Preview until');

  // After the settlement day, switching on applies it.
  await page.clock.setFixedTime(SETTLED);
  await page.reload();
  await asideOf(page)
    .getByRole('switch', { name: "Convert this week's excess to TOIL and overtime" })
    .click();
  await expect(asideOf(page)).toContainText('Applied Fri 9 Oct');
  await expect(page.getByRole('columnheader', { name: 'Converted', exact: true })).toBeVisible();
  // The worked example's levelling in 0:30 blocks: Tuesday converts 2:00 and keeps +0:30.
  await expect(row(page, 'Tue 6 Oct')).toContainText('2:00');
  await expect(row(page, 'Tue 6 Oct')).toContainText('+0:30 over');
  await expectNoA11yViolations(page);
});

test('an edit after settlement says what it recalculated', async ({ page }) => {
  await page.clock.setFixedTime(SETTLED);
  await signIn(page, E2E_WEEK_USER);
  await seedExampleWeek(page.request, true);
  await page.goto(`/hours?week=${EXAMPLE_WEEK}`);
  await expect(asideOf(page)).toContainText('Applied Fri 9 Oct');
  await expect(figure(page, 'TOIL')).toHaveText('3:00');

  // An hour less on Tuesday: the week's 3:00 of TOIL becomes 2:00.
  await field(page, 'End', 'Tue 6 Oct').focus();
  await typeInto(page, '1700');
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Tue 6 Oct saved')).toBeVisible();
  const message = 'Week of 5 Oct recalculated: TOIL 3:00 → 2:00, overtime 0:00 → 0:00.';
  await expect(toast(page, message)).toBeVisible();
  await expect(
    asideOf(page).getByRole('region', { name: 'Conversion' }).getByRole('status').filter({
      hasText: message,
    }),
  ).toBeVisible();
  await expect(figure(page, 'TOIL')).toHaveText('2:00');
  await expectNoA11yViolations(page);
});

test('the browser totals equal the API totals for the worked-example week', async ({ page }) => {
  await page.clock.setFixedTime(SETTLED);
  await signIn(page, E2E_WEEK_USER);
  await seedExampleWeek(page.request, true);
  const summary = await page.request.get(
    `${API}/time-summaries?from=${EXAMPLE_WEEK}&to=${SETTLED_DATE}&groupBy=week&asOf=${SETTLED_DATE}`,
  );
  expect(summary.ok()).toBe(true);
  const [group] = ((await summary.json()) as { data: Record<string, number>[] }).data;
  const balancesResponse = await page.request.get(`${API}/time-balances?asOf=${SETTLED_DATE}`);
  const balances = ((await balancesResponse.json()) as { data: Record<string, number> }).data;
  expect(group).toBeDefined();
  const api = group!;
  // The feature doc's figures, as the API gives them (no earlier October TOIL here).
  expect([api.workedMinutes, api.creditedMinutes, api.targetMinutes]).toEqual([2430, 2430, 2250]);
  expect([api.rawFlexiMinutes, api.convertedMinutes, api.flexiMinutes]).toEqual([180, 180, 0]);

  await page.goto(`/hours?week=${EXAMPLE_WEEK}`);
  const totals = page.getByRole('row', { name: /^Week/ });
  const totalCells = totals.getByRole('cell');
  // Worked, credited (of target), flexi and converted, after the cell under the five inputs.
  await expect(totalCells.nth(1)).toHaveText(hm(api.workedMinutes!));
  await expect(totalCells.nth(2)).toHaveText(
    `${hm(api.creditedMinutes!)} of ${hm(api.targetMinutes!)} target`,
  );
  await expect(totalCells.nth(3)).toHaveText(flexi(api.flexiMinutes!));
  await expect(totalCells.nth(4)).toHaveText(hm(api.convertedMinutes!));

  await expect(figure(page, 'Credited')).toHaveText(
    `${hm(api.creditedMinutes!)} of ${hm(api.targetMinutes!)} target`,
  );
  // The tiles' figures come first in their <dd>, before a detail line.
  await expect(figure(page, 'Week flexi')).toContainText(flexi(api.rawFlexiMinutes!));
  await expect(figure(page, 'After conversion')).toHaveText(
    flexi(api.rawFlexiMinutes! - api.conversionMinutes!),
  );
  await expect(figure(page, 'TOIL')).toHaveText(hm(api.conversionToilMinutes!));
  await expect(figure(page, 'Overtime')).toHaveText(
    `${hm(api.conversionOvertimeUnpaidMinutes!)} unpaid`,
  );
  await expect(figure(page, 'Flexi balance')).toContainText(flexi(balances.flexiMinutes!));
});
