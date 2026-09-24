import { liveWeekFigures } from '../this-week-figures';

import { BalancesPanel } from './balances-panel';
import { ThisWeekPanel } from './this-week-panel';
import type { WeekAsideContext } from './week-view';

/**
 * The week view's aside (feature doc → UI → Week view): the "This week" panel
 * over the "Balances" panel, in an `<aside>` landmark named "This week and
 * balances". Mount it through `WeekView`'s `aside` prop.
 *
 * The panels read the saved figures from the API. Only the week-local
 * figures of the view's own calculation (credited, target, the week's flexi
 * and its excess) are passed on as `live`, so the panel follows unsaved
 * typing; the conversion's TOIL and overtime split and the balances depend on
 * earlier weeks, so they are always the API's and move after a save.
 */
export function WeekAside({ weekStart, asOf, calculation, recalculationNotice }: WeekAsideContext) {
  const live = calculation ? liveWeekFigures(calculation.result, weekStart) : null;
  return (
    <aside aria-label="This week and balances" className="grid gap-4">
      <ThisWeekPanel
        weekStart={weekStart}
        asOf={asOf}
        live={live}
        recalculationNotice={recalculationNotice}
      />
      <BalancesPanel asOf={asOf} />
    </aside>
  );
}
