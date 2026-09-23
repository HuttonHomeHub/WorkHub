/**
 * The settings screen's tabs, in order (`/hours/settings?tab=`). Kept apart
 * from the components, with no imports, so the route's search validation can
 * use it without pulling the screen into the initial bundle.
 */
export const SETTINGS_TABS = ['terms', 'leave', 'balances', 'holidays'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
