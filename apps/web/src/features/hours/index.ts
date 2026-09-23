/**
 * Public surface of the hours tool (docs/FRONTEND_ARCHITECTURE.md). The Hours
 * manifest (`tool.ts`) joins the sidebar with the week view (slice 7); until
 * then the settings screen is reachable at `/hours/settings`.
 */
export { HoursSettings } from './components/hours-settings';
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
