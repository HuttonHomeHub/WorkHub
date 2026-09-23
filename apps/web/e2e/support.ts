import AxeBuilder from '@axe-core/playwright';
import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { E2E_USER } from './fixtures';

/** Asserts WCAG 2.2 AA with axe on the page as it is now (docs/ACCESSIBILITY.md). */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

/**
 * Signs in as a journey account (the shared one by default) and waits for the
 * protected home page.
 */
export async function signIn(
  page: Page,
  user: { email: string; name: string; password: string } = E2E_USER,
): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: `Welcome, ${user.name}` })).toBeVisible();
}

/** A row the API lists (every resource has an `id`). */
export interface Row {
  id: string;
}

/** Follows a list endpoint's cursor to the end, as the signed-in journey account. */
export async function listAll<T extends Row>(
  request: APIRequestContext,
  path: string,
): Promise<T[]> {
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

/** A toast's text, in the toaster (Radix also copies it into a live region). */
export function toast(page: Page, text: string): Locator {
  return page.getByRole('region', { name: 'Notifications' }).getByText(text);
}

/** Tab alone moves focus to the target, as a keyboard user would. */
export async function tabTo(page: Page, target: Locator, maxStops = 60): Promise<void> {
  for (let stop = 0; stop < maxStops; stop += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error(`Tab did not reach the target within ${String(maxStops)} stops`);
}

/** No page-level horizontal scroll (1.4.10); tables may scroll in their own container. */
export async function expectNoPageHorizontalScroll(page: Page): Promise<void> {
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
