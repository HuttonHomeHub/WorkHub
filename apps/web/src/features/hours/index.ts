/**
 * Public surface of the hours tool (docs/FRONTEND_ARCHITECTURE.md): what the
 * routes mount. The Hours manifest (`tool.ts`) is imported by `app/tools.ts`
 * directly, so the sidebar does not pull these screens into the initial
 * bundle. The week aside's panels and rule 11's helpers stay inside the
 * feature: `WeekAside` composes them.
 */
export { HoursSettings } from './components/hours-settings';
export { WeekView, type WeekAsideContext } from './components/week-view';
export { WeekAside } from './components/week-aside';
export { SETTINGS_TABS, type SettingsTab } from './settings-tabs';
export { hoursKeys } from './api/keys';
export { HoursSummary } from './components/hours-summary';
export type { SummaryGroupBy } from './summary-range';
