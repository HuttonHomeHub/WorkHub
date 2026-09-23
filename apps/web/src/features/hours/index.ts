/**
 * Public surface of the hours tool (docs/FRONTEND_ARCHITECTURE.md). The Hours
 * manifest (`tool.ts`) is imported by `app/tools.ts` directly, so the sidebar
 * does not pull these screens into the initial bundle.
 */
export { HoursSettings } from './components/hours-settings';
export { WeekView, type WeekAsideContext } from './components/week-view';
export { SETTINGS_TABS, type SettingsTab } from './settings-tabs';
export { hoursKeys } from './api/keys';
export { HoursSummary } from './components/hours-summary';
export type { SummaryGroupBy } from './summary-range';
export { ThisWeekPanel, type ThisWeekPanelProps } from './components/this-week-panel';
export { BalancesPanel, type BalancesPanelProps } from './components/balances-panel';
export { thisWeekFigures, type ThisWeekFigures } from './this-week-figures';
export { useRecalculationNotice } from './hooks/use-recalculation-notice';
export { recalculationMessage } from './recalculation-message';
export { WARNING_LABELS, countWarnings } from './warnings';
