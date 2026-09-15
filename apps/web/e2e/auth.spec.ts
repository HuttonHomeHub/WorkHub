import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { E2E_USER } from './fixtures';

/**
 * The critical auth journey (docs/TESTING.md): closed sign-up → sign-in →
 * protected page → sign-out, plus automated WCAG 2.2 AA checks on each screen
 * (docs/FRONTEND_QUALITY.md — a11y is a merge requirement). The account comes
 * from `global-setup.ts` because public sign-up is off by default (ADR-0018).
 */

async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

test('offers no public sign-up by default', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create one' })).toHaveCount(0);

  // The sign-up page itself is unreachable.
  await page.goto('/sign-up');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('signs in, reaches the protected home, and signs out', async ({ page }) => {
  // Unauthenticated visitors are redirected to sign-in.
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await expectNoA11yViolations(page);

  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Landed on the protected home page, with the profile from GET /api/v1/me.
  await expect(page.getByRole('heading', { name: `Welcome, ${E2E_USER.name}` })).toBeVisible();
  await expectNoA11yViolations(page);

  // Sign out → back to sign-in; the protected page is gone.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
});

test('shows validation errors and rejects wrong credentials', async ({ page }) => {
  await page.goto('/sign-in');

  // Client-side validation (RHF + Zod).
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();

  // Server rejection surfaces a friendly error.
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password').fill('definitely-wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Wrong email or password');
});
