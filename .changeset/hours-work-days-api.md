---
'@repo/api': minor
---

Add the hours tracker's work days API (one start, end, break, leave and TOIL taken per date, with night shifts and the rules on leave, bank holidays and overlapping shifts) and the weekly "convert this week's excess" switch. The release includes a database migration that adds two tables; take a `pg_dump` before upgrading, as the routine upgrade does.
