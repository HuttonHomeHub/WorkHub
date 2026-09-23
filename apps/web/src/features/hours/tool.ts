import { Clock } from 'lucide-react';

import type { ToolManifest } from '@/lib/tool-manifest';

/**
 * The hours tool's manifest (ADR-0020, docs/features/hours-tracker.md → UI):
 * its sidebar entry and its command-palette commands. `app/tools.ts` imports
 * this file directly, not through `index.ts`, so the sidebar never pulls the
 * tool's screens into the initial bundle.
 */
export const hoursTool: ToolManifest = {
  id: 'hours',
  label: 'Hours',
  icon: Clock,
  path: '/hours',
  commands: [
    { id: 'hours.go', label: 'Go to Hours' },
    { id: 'hours.go-to-today', label: 'Hours: go to today' },
    { id: 'hours.open-summary', label: 'Hours: open summary' },
    { id: 'hours.download-month-csv', label: 'Hours: download this month as CSV' },
    { id: 'hours.open-settings', label: 'Hours: open settings' },
  ],
};
