---
'@repo/api': minor
---

Add `pnpm data:export --email <owner>`, which writes all of an owner's data to a JSON file readable by them only (inside the api container: `node dist/cli/data-export.js --email <owner> --out /tmp/export.json`). The export is not a backup; automated backups are still to come.
