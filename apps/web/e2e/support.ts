import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

import { E2E_USER } from './fixtures';

/** Asserts WCAG 2.2 AA with axe on the page as it is now (docs/ACCESSIBILITY.md). */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
}

/** Signs in as the journey account and waits for the protected home page. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(E2E_USER.email);
  await page.getByLabel('Password').fill(E2E_USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: `Welcome, ${E2E_USER.name}` })).toBeVisible();
}
