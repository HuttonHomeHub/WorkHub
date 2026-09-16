import { expect, test, type Locator, type Page } from '@playwright/test';

import { E2E_USER } from './fixtures';
import { expectNoA11yViolations, signIn } from './support';

/**
 * The app shell journey (docs/UX_STANDARDS.md → App shell; hours tracker slice
 * 1): the tools sidebar expanded and as the rail, its persisted state, the skip
 * link and keyboard navigation, with axe on every state, at the two design
 * viewports and at the 320 CSS px reflow floor (a 1280×800 window at 400% zoom).
 */

const SIDEBAR_WIDTH = 240;
const RAIL_WIDTH = 56;

function sidebar(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Tools' });
}

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return Math.round(box?.width ?? 0);
}

/** Moves focus to an element with Tab alone, as a keyboard user would. */
async function tabTo(page: Page, target: Locator, maxStops = 20): Promise<void> {
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
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
]) {
  test.describe(`at ${String(viewport.width)}×${String(viewport.height)}`, () => {
    test.use({ viewport });

    test('shows the expanded sidebar with the current tool marked', async ({ page }) => {
      await signIn(page);

      const home = sidebar(page).getByRole('link', { name: 'Home' });
      await expect(home).toHaveAttribute('aria-current', 'page');
      await expect(home.getByText('Home')).toBeVisible();
      expect(await widthOf(sidebar(page))).toBe(SIDEBAR_WIDTH);

      // The label is visible, so focusing the link shows no tooltip.
      await tabTo(page, home);
      await expect(home).toHaveAttribute('data-state', /open/);
      await expect(page.getByRole('tooltip')).toHaveCount(0);

      // Content is no longer capped at 1024px; it fills the window beside the sidebar.
      const main = page.getByRole('main');
      expect(await widthOf(main)).toBe(viewport.width - SIDEBAR_WIDTH);
      await expectNoPageHorizontalScroll(page);
      await expectNoA11yViolations(page);

      // And in the dark theme (the default `system` theme follows the OS).
      // Reduced motion, so axe does not sample colours mid-transition.
      await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
      await expect(page.locator('html')).toHaveClass(/\bdark\b/);
      await expectNoA11yViolations(page);
    });

    test('collapses to the rail with tooltips, and restores it before first paint', async ({
      page,
    }) => {
      await signIn(page);
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
      expect(await widthOf(sidebar(page))).toBe(RAIL_WIDTH);

      // Icon only, but still named, with the label in a tooltip on hover and focus.
      const home = sidebar(page).getByRole('link', { name: 'Home' });
      await expect(home).toHaveAttribute('aria-current', 'page');
      await home.hover();
      await expect(page.getByRole('tooltip', { name: 'Home' })).toBeVisible();
      await expectNoA11yViolations(page);
      await page.mouse.move(viewport.width - 10, viewport.height - 10, { steps: 5 });
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await tabTo(page, home);
      await expect(page.getByRole('tooltip', { name: 'Home' })).toBeVisible();

      // Reloaded, the rail is back.
      await page.reload();
      await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
      expect(await widthOf(sidebar(page))).toBe(RAIL_WIDTH);

      // The pre-paint script alone (no app JavaScript) applies the stored state.
      await page.route('**/*', (route) =>
        route.request().resourceType() === 'script' ? route.abort() : route.continue(),
      );
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
    });

    test('is keyboard operable: skip link, sidebar toggle and tool links', async ({ page }) => {
      await signIn(page);
      await page.goto('/');
      await expect(sidebar(page)).toBeVisible();

      // The first Tab stop reveals the skip link; Enter moves focus to <main>.
      await page.keyboard.press('Tab');
      const skip = page.getByRole('link', { name: 'Skip to main content' });
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();
      await expectNoA11yViolations(page);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('main')).toBeFocused();

      // The toggle works from the keyboard and keeps focus.
      const collapse = page.getByRole('button', { name: 'Collapse sidebar' });
      await tabTo(page, collapse);
      await page.keyboard.press('Enter');
      const expand = page.getByRole('button', { name: 'Expand sidebar' });
      await expect(expand).toBeFocused();
      expect(await widthOf(sidebar(page))).toBe(RAIL_WIDTH);
      await page.keyboard.press('Space');
      await expect(collapse).toBeFocused();
      expect(await widthOf(sidebar(page))).toBe(SIDEBAR_WIDTH);

      // Tool links are in the tab order after the header, and Enter follows them.
      const home = sidebar(page).getByRole('link', { name: 'Home' });
      await tabTo(page, home);
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/$/);
      await expect(home).toHaveAttribute('aria-current', 'page');
    });
  });
}

test.describe('at the 320 CSS px reflow floor (1280×800 at 400% zoom)', () => {
  test('keeps the rail and every function without page-level horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signIn(page);
    await page.setViewportSize({ width: 320, height: 200 });

    // The preference is expanded, but the floor always shows the rail.
    await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'expanded');
    expect(await widthOf(sidebar(page))).toBe(RAIL_WIDTH);
    // The toggle would do nothing here, so it is not offered.
    await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeHidden();

    const home = sidebar(page).getByRole('link', { name: 'Home' });
    await expect(home).toHaveAttribute('aria-current', 'page');
    await tabTo(page, home);
    await expect(page.getByRole('tooltip', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('tooltip', { name: 'Home' })).toBeInViewport();

    // Nothing in the header is hidden or clipped: it wraps instead.
    await expect(page.getByRole('banner').getByText(E2E_USER.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Switch to (light|dark) theme/ })).toBeVisible();

    await expectNoPageHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });
});
