import { defineConfig, devices } from '@playwright/test';

// Sandboxed environments (e.g. cloud dev containers) provide a system
// Chromium instead of Playwright's managed download — point at it with
// PLAYWRIGHT_CHROMIUM_EXECUTABLE.
function chromiumConfig() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  return {
    ...devices['Desktop Chrome'],
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  };
}

// End-to-end test configuration for the WorkHub web client.
// Playwright starts BOTH dev servers (API + web) unless PLAYWRIGHT_SKIP_WEBSERVER
// is set (e.g. to test an already-running deployment via E2E_BASE_URL).
// The API needs a database: set DATABASE_URL and apply migrations first
// (CI does this; locally `docker compose up db` + `pnpm --filter @repo/api prisma:migrate`).
export default defineConfig({
  testDir: './e2e',
  // Creates the journey account (public sign-up is off by default, ADR-0018).
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serialise workers in CI for determinism; use Playwright's default locally.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // CI runs chromium only (speed + one browser install); the full matrix runs
  // locally and can be brought to CI once journeys grow.
  projects: process.env.CI
    ? [{ name: 'chromium', use: chromiumConfig() }]
    : [
        { name: 'chromium', use: chromiumConfig() },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ],
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {}
    : {
        webServer: [
          {
            // Via Turbo so workspace packages the API loads at runtime
            // (@repo/types, ADR-0017) are built first.
            command: 'pnpm exec turbo run dev --filter=@repo/api',
            url: 'http://localhost:3000/health',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
          {
            command: 'pnpm dev',
            url: 'http://localhost:5173',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ],
      }),
});
