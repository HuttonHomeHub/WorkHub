---
'@repo/api': minor
'@repo/web': patch
---

Converting a week's excess now works in **whole blocks**, to match a timesheet filled in by the half hour. With the switch on, only whole blocks of the week's excess become TOIL and overtime, taken a block at a time from the days furthest over their target; minutes that don't make a whole block **stay as flexi**. For example, an excess of 2:45 converts 2:30, and 0:15 stays in your flexi balance. The block is a new work terms setting, **Conversion block** under Settings → Terms → Limits, 0:30 by default (any length from 0:01 to 8:00, effective from the Monday the terms start). The week view's This week panel says when some of the excess stays as flexi ("0:15 stays as flexi"), and "Less than one block (0:30) to convert" when the excess is under one block. Existing terms take the 0:30 default, so weeks that are already converted may show slightly different daily figures (for example, the worked-example Tuesday converts 2:00 instead of 1:50); the week's TOIL and overtime totals only change where the excess wasn't a whole number of blocks. The upgrade adds one database column; no action is needed.
