import { expect, test, type Locator, type Page } from '@playwright/test';

import { E2E_USER } from './fixtures';
import { expectNoA11yViolations, signIn } from './support';

/**
 * The app shell journey (docs/UX_STANDARDS.md → App shell; hours tracker slice
 * 1): the tools sidebar expanded and as the rail, its persisted state, the skip
 * link and keyboard navigation, with axe on every state, at the two design
 * viewports and at the 320 CSS px reflow floor (a 1280×800 window at 400% zoom).
 */

const SIDEBAR_WIDTH = 224;
const RAIL_WIDTH = 56;

function sidebar(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Tools' });
}

function sidebarToggle(page: Page): Locator {
  return page.getByRole('button', { name: 'Sidebar' });
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

      // The label is visible, so focusing or hovering the link opens no
      // tooltip and adds no description.
      await tabTo(page, home);
      await home.hover();
      await page.waitForTimeout(600);
      await expect(page.getByRole('tooltip')).toHaveCount(0);
      await expect(home).not.toHaveAttribute('aria-describedby');

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
      await expect(sidebarToggle(page)).toHaveAttribute('aria-expanded', 'true');
      await sidebarToggle(page).click();
      await expect(sidebarToggle(page)).toHaveAttribute('aria-expanded', 'false');
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
      await expect(sidebarToggle(page)).toHaveAttribute('aria-expanded', 'false');
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
      const toggle = sidebarToggle(page);
      await expect(toggle).toHaveAttribute('aria-controls', 'sidebar');
      await expect(sidebar(page)).toHaveAttribute('id', 'sidebar');
      await tabTo(page, toggle);
      await expect(page.getByRole('tooltip', { name: 'Collapse sidebar' })).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(await widthOf(sidebar(page))).toBe(RAIL_WIDTH);
      await page.keyboard.press('Space');
      await expect(toggle).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
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
    await expect(sidebarToggle(page)).toBeHidden();

    const home = sidebar(page).getByRole('link', { name: 'Home' });
    await expect(home).toHaveAttribute('aria-current', 'page');
    await tabTo(page, home);
    await expect(page.getByRole('tooltip', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('tooltip', { name: 'Home' })).toBeInViewport();

    // Nothing in the header is hidden or clipped: it wraps instead.
    await expect(page.getByRole('banner').getByText(E2E_USER.email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Theme: / })).toBeVisible();

    await expectNoPageHorizontalScroll(page);
    await expectNoA11yViolations(page);
  });
});

test.describe('the theme menu', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('switches light, dark and system from the keyboard, and keeps the choice', async ({
    page,
  }) => {
    await signIn(page);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    const trigger = page.getByRole('button', { name: /^Theme: / });
    await expect(trigger).toHaveAccessibleName('Theme: System');

    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expectNoA11yViolations(page);
    await menu.getByRole('menuitemradio', { name: 'Dark' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(page.getByRole('button', { name: 'Theme: Dark' })).toBeFocused();
    // The focus the menu hands back does not bring the tooltip up.
    await page.waitForTimeout(600);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expectNoA11yViolations(page);

    // Kept across a reload, before first paint.
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);

    // With the mouse: the tooltip names the button on hover, never shows over
    // the open menu, and is gone once a choice closes it.
    const button = page.getByRole('button', { name: 'Theme: Dark' });
    await button.hover();
    await expect(page.getByRole('tooltip', { name: 'Theme' })).toBeVisible();
    await button.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.getByRole('menuitemradio', { name: 'System' }).click();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await page.mouse.move(600, 500);
    await page.waitForTimeout(600);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });
});

test.describe('focus after a route change (WCAG 2.4.3)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('signing in with the keyboard moves focus to main; the initial load does not', async ({
    page,
  }) => {
    await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    // The initial load (including the redirect to sign-in) leaves focus alone.
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    await page.getByLabel('Email').focus();
    await page.keyboard.type(E2E_USER.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(E2E_USER.password);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: `Welcome, ${E2E_USER.name}` })).toBeVisible();
    await expect(page.getByRole('main')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
  });

  test('a search-param-only change keeps focus where it is', async ({ page }) => {
    await signIn(page);
    const home = sidebar(page).getByRole('link', { name: 'Home' });
    await home.focus();
    await page.evaluate(() => {
      window.history.pushState(window.history.state, '', '/?probe=1');
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
    });
    await expect(page).toHaveURL(/\?probe=1$/);
    await page.waitForTimeout(300);
    await expect(home).toBeFocused();
  });
});
