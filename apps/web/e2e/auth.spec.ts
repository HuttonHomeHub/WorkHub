import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The critical auth journey (docs/TESTING.md): open signup → protected page →
 * sign-out → sign-in, plus automated WCAG 2.2 AA checks on each screen
 * (docs/FRONTEND_QUALITY.md — a11y is a merge requirement).
 */

const password = 'a-strong-password-123';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

test('signs up, reaches the protected home, signs out, signs back in', async ({ page }) => {
  const email = uniqueEmail();

  // Unauthenticated visitors are redirected to sign-in.
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in/);
  await expectNoA11yViolations(page);

  // Open signup.
  await page.getByRole('link', { name: 'Create one' }).click();
  await expect(page).toHaveURL(/\/sign-up/);
  await expectNoA11yViolations(page);

  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Landed on the protected home page.
  await expect(page.getByRole('heading', { name: 'Welcome, E2E User' })).toBeVisible();
  await expectNoA11yViolations(page);

  // Sign out → back to sign-in; the protected page is gone.
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  // Sign back in.
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome, E2E User' })).toBeVisible();
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
