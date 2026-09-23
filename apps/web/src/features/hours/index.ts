/**
 * Public surface of the hours tool (docs/FRONTEND_ARCHITECTURE.md). The Hours
 * manifest (`tool.ts`) joins the sidebar with the week view (slice 7); until
 * then the settings screen is reachable at `/hours/settings`.
 */
export { HoursSettings } from './components/hours-settings';
export { SETTINGS_TABS, type SettingsTab } from './settings-tabs';
export { hoursKeys } from './api/keys';
