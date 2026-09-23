import type { HoursResult } from '@repo/domain';
import * as React from 'react';

import { recalculationMessage } from '../recalculation-message';

import { toast } from '@/components/ui/toast';

/**
 * Tells the owner what an edit after settlement changed (rule 11; feature
 * doc → UI → Edits after settlement). After a day saves, call
 * `notify(before, after, weekStart)` with the engine's results from before
 * and after the edit: when the week's conversion or an ended month moved, it
 * raises a 4-second info toast and returns the message. `notice` holds the
 * latest message for the aside's polite live region (`ThisWeekPanel`'s
 * `recalculationNotice`), and is cleared when the week changes.
 */
export function useRecalculationNotice(weekStart: string) {
  const [notice, setNotice] = React.useState({ weekStart, message: '' });
  const notify = React.useCallback(
    (before: HoursResult, after: HoursResult, editedWeekStart: string): string | null => {
      const message = recalculationMessage(before, after, editedWeekStart);
      if (message === null) return null;
      setNotice({ weekStart: editedWeekStart, message });
      toast({ variant: 'info', title: message });
      return message;
    },
    [],
  );
  return { notice: notice.weekStart === weekStart ? notice.message : '', notify };
}
