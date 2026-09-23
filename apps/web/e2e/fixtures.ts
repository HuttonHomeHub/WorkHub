/** The account the journeys sign in with; created by `global-setup.ts`. */
export const E2E_USER = {
  email: 'e2e-journey@example.com',
  name: 'E2E User',
  password: 'e2e-journey-password',
} as const;

/**
 * The week view's journey account (`hours-week.spec.ts`), kept apart from
 * `E2E_USER`: its terms start in the past, which would move the settings
 * journeys' tracking start.
 */
export const E2E_WEEK_USER = {
  email: 'e2e-week-journey@example.com',
  name: 'E2E Week User',
  password: 'e2e-week-journey-password',
} as const;
