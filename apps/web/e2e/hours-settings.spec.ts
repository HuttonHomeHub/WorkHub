import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { expectNoA11yViolations, signIn } from './support';

/**
 * The hours settings journeys (hours tracker slice 5): setting terms, bought
 * leave, a bank holiday import, and undo, with axe on every screen, at the
 * 1280×800 design floor and reflowed at 320 CSS px (400% zoom).
 *
 * The journey account persists between runs, so each journey works on data
 * of its own — a far-future Monday, a leave year and a holiday year no one
 * uses — and resets that data through the API first. The journeys share the
 * account, so they run one at a time.
 */
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1280, height: 800 } });

const API = '/api/v1';

interface Row {
  id: string;
}

async function listAll<T extends Row>(request: APIRequestContext, path: string): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  do {
    const url: string = cursor ? `${path}${path.includes('?') ? '&' : '?'}cursor=${cursor}` : path;
    const response = await request.get(url);
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      data: T[];
      meta: { nextCursor: string | null; hasMore: boolean };
    };
    rows.push(...body.data);
    cursor = body.meta.hasMore ? body.meta.nextCursor : null;
  } while (cursor);
  return rows;
}

/** A Monday in 2090 no other journey uses, so repeated runs never collide. */
function farMonday(week: number): string {
  // 2 January 2090 is a Monday.
  const date = new Date(Date.UTC(2090, 0, 2 + 7 * week));
  return date.toISOString().slice(0, 10);
}

/**
 * Terms that stay in place, earlier than every journey's Monday, so a
 * journey's own terms are never the owner's last (which the API refuses to
 * delete). Created once; later runs find them.
 */
const ANCHOR_MONDAY = '2089-12-26';

async function ensureAnchorTerms(request: APIRequestContext): Promise<void> {
  const response = await request.post(`${API}/work-terms`, {
    data: { effectiveFrom: ANCHOR_MONDAY },
  });
  // 201 created, or 409: they already exist.
  expect([201, 409]).toContain(response.status());
}

async function deleteTermsFrom(request: APIRequestContext, effectiveFrom: string): Promise<void> {
  await ensureAnchorTerms(request);
  const terms = await listAll<Row & { effectiveFrom: string }>(request, `${API}/work-terms`);
  for (const row of terms.filter((term) => term.effectiveFrom === effectiveFrom)) {
    await request.delete(`${API}/work-terms/${row.id}`);
  }
}

/** A toast's text, in the toaster (Radix also copies it into a live region). */
function toast(page: Page, text: string): Locator {
  return page.getByRole('region', { name: 'Notifications' }).getByText(text);
}

/** Tab alone moves focus to the target, as a keyboard user would. */
async function tabTo(page: Page, target: Locator, maxStops = 60): Promise<void> {
  for (let stop = 0; stop < maxStops; stop += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach the target within ${String(maxStops)} stops`);
}

async function expectNoPageHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  // Name the elements that stick out, so a failure says where to look.
  const offenders = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > width + 0.5)
      .filter((element) => !element.parentElement?.closest('.overflow-x-auto'))
      .slice(0, 5)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()} "${(element.textContent ?? '').slice(0, 40)}"`,
      );
  });
  expect(overflow, `${page.url()}: ${offenders.join('; ')}`).toBeLessThanOrEqual(0);
}

test('sets new terms from a Monday, and they are there after a reload', async ({ page }) => {
  await signIn(page);
  const monday = farMonday(0);
  await deleteTermsFrom(page.request, monday);

  await page.goto('/hours/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Hours settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Terms' })).toHaveAttribute('aria-selected', 'true');
  const form = page.getByRole('form', { name: 'New terms' });
  await expect(form).toBeVisible();
  await expectNoA11yViolations(page);

  await form.getByLabel('Applies from').fill(monday);
  const fridayTarget = form.getByLabel('Friday flexi target');
  await fridayTarget.fill('6h');
  await fridayTarget.blur();
  // Parsed on blur, and shown as h:mm.
  await expect(fridayTarget).toHaveValue('6:00');
  await form.getByLabel('Friday minimum').fill('5:30');
  await form.getByRole('switch', { name: 'Paid overtime allowed' }).click();
  await form.getByRole('button', { name: 'Save new terms' }).click();

  const saved = `Mon ${String(new Date(`${monday}T00:00:00Z`).getUTCDate())} Jan 2090`;
  await expect(toast(page, `Terms from ${saved} saved`)).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(saved) });
  await expect(row).toContainText('36:00');
  await expect(row).toContainText('Allowed');
  await expectNoA11yViolations(page);

  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(saved) })).toContainText('36:00');

  // Validation: a minimum above its target is flagged on the field, not sent.
  await page.getByRole('button', { name: `Edit terms from ${saved}` }).click();
  const edit = page.getByRole('form', { name: 'Edit terms' });
  await edit.getByLabel('Friday minimum').fill('6:30');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(edit.getByLabel('Friday minimum')).toHaveAttribute('aria-invalid', 'true');
  await expect(edit.getByText('Use at most the flexi target, 6:00.')).toBeVisible();
  await expect(edit.getByLabel('Friday minimum')).toBeFocused();
  await expectNoA11yViolations(page);
  await edit.getByRole('button', { name: 'Cancel' }).click();

  await deleteTermsFrom(page.request, monday);
});

test('deletes terms and undoes it from the keyboard, within the 8s toast', async ({ page }) => {
  await signIn(page);
  const monday = farMonday(1);
  await deleteTermsFrom(page.request, monday);
  const created = await page.request.post(`${API}/work-terms`, {
    data: { effectiveFrom: monday },
  });
  expect(created.status()).toBe(201);

  await page.goto('/hours/settings?tab=terms');
  const label = `Mon ${String(new Date(`${monday}T00:00:00Z`).getUTCDate())} Jan 2090`;
  const remove = page.getByRole('button', { name: `Delete terms from ${label}` });
  await remove.focus();
  await page.keyboard.press('Enter');

  await expect(toast(page, `Terms from ${label} deleted`)).toBeVisible();
  await expect(remove).toHaveCount(0);
  // Focus moved to a neighbouring row, not to <body>.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
  await expectNoA11yViolations(page);

  const undo = page.getByRole('button', { name: 'Undo' });
  await tabTo(page, undo);
  await page.keyboard.press('Enter');
  await expect(toast(page, 'Terms restored')).toBeVisible();
  await expect(page.getByRole('button', { name: `Delete terms from ${label}` })).toBeVisible();

  await deleteTermsFrom(page.request, monday);
});

test('keeps the open tab in the URL, so back and reload restore it', async ({ page }) => {
  await signIn(page);
  await page.goto('/hours/settings');
  const terms = page.getByRole('tab', { name: 'Terms' });
  await terms.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/[?&]tab=leave\b/);
  await expect(page.getByRole('tab', { name: 'Leave' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Leave years' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Leave' })).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(terms).toHaveAttribute('aria-selected', 'true');
});

test('switches bought leave on a year; it saves at once and survives a reload', async ({
  page,
}) => {
  await signIn(page);
  const year = 2089;
  // Make sure the year exists (a 409 means it already does).
  await page.request.post(`${API}/leave-years`, {
    data: { year, allowanceMinutes: 14_850, boughtLeave: false },
  });

  await page.goto('/hours/settings?tab=leave');
  const toggle = page.getByRole('switch', { name: `Bought leave for ${String(year)}` });
  await expect(toggle).toBeVisible();
  const wasOn = (await toggle.getAttribute('aria-checked')) === 'true';
  const row = page.getByRole('row', { name: new RegExp(`^${String(year)}`) });
  await expectNoA11yViolations(page);

  await toggle.click();
  await expect(row.getByRole('status')).toHaveText('Saved');
  await expect(toggle).toHaveAttribute('aria-checked', String(!wasOn));
  await expect(row).toContainText(wasOn ? '247:30' : '285:00');
  await expect(page.getByText(/Used and remaining hours are not worked out yet/)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('switch', { name: `Bought leave for ${String(year)}` }),
  ).toHaveAttribute('aria-checked', String(!wasOn));
  await expectNoA11yViolations(page);
});

test('imports a year of England and Wales bank holidays, and undoes a delete', async ({ page }) => {
  await signIn(page);
  const year = 2031;
  const existing = await listAll<Row>(
    page.request,
    `${API}/public-holidays?from=${String(year)}-01-01&to=${String(year + 1)}-01-01`,
  );
  for (const row of existing) await page.request.delete(`${API}/public-holidays/${row.id}`);

  await page.goto(`/hours/settings?tab=holidays&year=${String(year)}`);
  await expect(page.getByRole('heading', { name: `Holidays in ${String(year)}` })).toBeVisible();
  await expect(page.getByText(`No holidays in ${String(year)} yet.`)).toBeVisible();
  await expectNoA11yViolations(page);

  await page
    .getByRole('button', { name: `Add England and Wales bank holidays for ${String(year)}` })
    .click();
  await expect(toast(page, `8 bank holidays added for ${String(year)}`)).toBeVisible();
  const table = page.getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(9);
  await expect(table.getByRole('cell', { name: 'Christmas Day', exact: true })).toBeVisible();
  await expectNoA11yViolations(page);

  // Importing again adds nothing, and says so.
  await page
    .getByRole('button', { name: `Add England and Wales bank holidays for ${String(year)}` })
    .click();
  await expect(
    toast(page, `You already have every England and Wales bank holiday for ${String(year)}`),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Delete Christmas Day', exact: true }).click();
  await expect(toast(page, 'Christmas Day deleted')).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(8);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(toast(page, 'Christmas Day restored')).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(9);

  // The year is in the URL: the next year is one click away and bookmarkable.
  await page.getByRole('button', { name: 'Next year' }).click();
  await expect(page).toHaveURL(new RegExp(`year=${String(year + 1)}`));
  await expect(
    page.getByRole('heading', { name: `Holidays in ${String(year + 1)}` }),
  ).toBeVisible();
});

test('passes axe in the dark theme', async ({ page }) => {
  await signIn(page);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto('/hours/settings');
  await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  await expect(page.getByRole('form', { name: 'New terms' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.goto('/hours/settings?tab=leave');
  await expect(page.getByRole('heading', { name: 'Leave years' })).toBeVisible();
  await expectNoA11yViolations(page);
});

test.describe('at the 320 CSS px reflow floor (1280×800 at 400% zoom)', () => {
  test('every tab reflows without page-level horizontal scroll', async ({ page }) => {
    await signIn(page);
    await page.setViewportSize({ width: 320, height: 200 });
    for (const [tab, ready] of [
      ['terms', page.getByRole('form', { name: 'New terms' })],
      ['leave', page.getByRole('heading', { name: 'Leave years' })],
      ['balances', page.getByRole('heading', { name: 'Balance adjustments' })],
      ['holidays', page.getByRole('button', { name: /Add England and Wales bank holidays/ })],
    ] as const) {
      await page.goto(`/hours/settings?tab=${tab}`);
      await expect(ready).toBeVisible();
      await expectNoPageHorizontalScroll(page);
      await expectNoA11yViolations(page);
    }
    // The tabs wrap rather than hide: all four stay reachable.
    for (const name of ['Terms', 'Leave', 'Balances', 'Holidays']) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
  });
});
