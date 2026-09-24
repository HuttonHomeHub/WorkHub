import { SETTINGS_TABS, type SettingsTab } from '../settings-tabs';

import { BalancesTab } from './balances-tab';
import { HolidaysTab } from './holidays-tab';
import { LeaveTab } from './leave-tab';
import { TermsTab } from './terms-tab';

import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TAB_LABELS: Record<SettingsTab, string> = {
  terms: 'Terms',
  leave: 'Leave',
  balances: 'Balances',
  holidays: 'Holidays',
};

interface HoursSettingsProps {
  /** The open tab, from the URL (`?tab=`). */
  tab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
  /** The holidays tab's year, from the URL (`?year=`). */
  year: number;
  onYearChange: (year: number) => void;
}

function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(value);
}

/**
 * The hours settings screen (feature doc → UI → Settings): four tabs, each
 * loading its own data when opened. The open tab and the holidays year live in
 * the URL, so reload, back and forward restore the view.
 */
export function HoursSettings({ tab, onTabChange, year, onYearChange }: HoursSettingsProps) {
  return (
    // Settings are forms and short lists: capped at the form width, at the content's left edge.
    <div className="grid max-w-(--width-form) grid-cols-1 gap-6">
      <PageHeader
        title="Hours settings"
        description="Your working terms, leave years, opening balances and bank holidays."
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (isSettingsTab(value)) onTabChange(value);
        }}
      >
        <TabsList aria-label="Settings">
          {SETTINGS_TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {TAB_LABELS[value]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="terms">
          <TermsTab />
        </TabsContent>
        <TabsContent value="leave">
          <LeaveTab />
        </TabsContent>
        <TabsContent value="balances">
          <BalancesTab />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab year={year} onYearChange={onYearChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
