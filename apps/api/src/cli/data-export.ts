import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { PrismaService } from '../prisma/prisma.service';

import { runWithApp } from './bootstrap';
import { ExportError, exportOwnerData } from './export';
import { writeExportFile } from './export-file';

const USAGE = `Export one owner's data to JSON (docs/DATABASE.md → Data export).

  pnpm data:export --email <email> [--out <file>] [--force]

Options:
  --out <file>   where to write (default: workhub-export-<date>.json in the
                 directory you ran the command from)
  --force        replace an existing file

The file is created readable by you only (mode 0600). It holds personal data:
keep it private, and don't leave it on the server.
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    // pnpm may forward a literal `--` separator.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    options: {
      email: { type: 'string' },
      out: { type: 'string' },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help || !values.email) {
    process.stdout.write(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  const email = values.email;
  const today = new Date().toISOString().slice(0, 10);
  // pnpm runs the script in apps/api; INIT_CWD is where the owner typed it.
  const base = process.env.INIT_CWD ?? process.cwd();
  const out = resolve(base, values.out ?? `workhub-export-${today}.json`);
  // A friendly early check; writeExportFile is what guarantees it.
  if (existsSync(out) && !values.force) {
    throw new ExportError(`${out} already exists. Pass --force to overwrite it.`);
  }

  await runWithApp(async (app) => {
    const data = await exportOwnerData(app.get(PrismaService), email);
    // The owner's personal data: a fresh file readable by the owner only.
    writeExportFile(out, `${JSON.stringify(data, null, 2)}\n`, values.force);
    const counts = Object.entries(data.tables)
      .map(([table, rows]) => `${table} ${rows.length}`)
      .join(', ');
    process.stdout.write(`Exported ${data.owner.email} to ${out}\n(${counts})\n`);
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
