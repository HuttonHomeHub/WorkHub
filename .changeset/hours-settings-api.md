---
'@repo/api': minor
'@repo/types': minor
---

Add the hours tracker's settings API: effective-dated work terms, leave years, time adjustments and public holidays, with a one-step import of the England and Wales bank holidays for a year (2019–2040). The release includes a database migration that adds four tables; take a `pg_dump` before upgrading, as the routine upgrade does.
