import * as React from 'react';

import { toast } from '@/components/ui/toast';

/**
 * Tells the owner what an edit after settlement changed (rule 11; feature
 * doc → UI → Edits after settlement). After a day saves, call
 * `announce(message, weekStart)` with rule 11's message
 * (`summaryRecalculationMessage` or `recalculationMessage`): a message raises
 * a 4-second info toast, and `null` (nothing moved) does nothing. `notice`
 * holds the latest message for the aside's polite live region
 * (`ThisWeekPanel`'s `recalculationNotice`), and is cleared when the week
 * changes.
 */
export function useRecalculationNotice(weekStart: string) {
  const [notice, setNotice] = React.useState({ weekStart, message: '' });
  const announce = React.useCallback((message: string | null, editedWeekStart: string) => {
    if (message === null) return;
    setNotice({ weekStart: editedWeekStart, message });
    toast({ variant: 'info', title: message });
  }, []);
  return { notice: notice.weekStart === weekStart ? notice.message : '', announce };
}
