import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { E2E_USER, E2E_WEEK_USER } from './fixtures';

/**
 * Public sign-up is off by default (ADR-0018), so the journeys sign in with an
 * account created — or reset — through the API's account CLI. Runs after
 * Playwright's webServer has started the API, whose dev build provides
 * `dist/cli/user.js`. Needs DATABASE_URL (CI env, or the repo-root .env).
 *
 * The accounts' passwords are in the repository, so they are only ever
 * created in a throwaway database: one whose name ends in `_test`, or CI's.
 */
export default function globalSetup(): void {
  assertTestDatabase();
  for (const user of [E2E_USER, E2E_WEEK_USER]) createUser(user);
}

const ROOT_ENV = fileURLToPath(new URL('../../../.env', import.meta.url));

/**
 * The database the account CLI will use: `DATABASE_URL` from the
 * environment, else the repo-root `.env`'s (`--env-file-if-exists` never
 * overrides a variable that is already set).
 */
function databaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!existsSync(ROOT_ENV)) return undefined;
  const line = readFileSync(ROOT_ENV, 'utf8')
    .split(/\r?\n/)
    .find((entry) => /^\s*DATABASE_URL\s*=/.test(entry));
  return line
    ?.slice(line.indexOf('=') + 1)
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2');
}

/** Refuses to run unless the journeys' database is a `*_test` one (or this is CI). */
export function assertTestDatabase(url = databaseUrl(), ci = process.env.CI): void {
  if (ci === 'true') return;
  let name = '';
  try {
    name = url ? decodeURIComponent(new URL(url).pathname.replace(/^\//, '')) : '';
  } catch {
    // An unreadable URL is refused below.
  }
  if (!name.endsWith('_test')) {
    throw new Error(
      `Playwright creates journey accounts with public passwords, so it runs only against a database whose name ends in "_test" (DATABASE_URL names "${name || 'none'}"). Point DATABASE_URL at app_test (docs/TESTING.md).`,
    );
  }
}

function createUser(user: { email: string; name: string; password: string }): void {
  execFileSync(
    'node',
    [
      '--env-file-if-exists=../../.env',
      'dist/cli/user.js',
      'create',
      '--email',
      user.email,
      '--name',
      user.name,
      '--password-stdin',
      '--upsert',
    ],
    {
      cwd: fileURLToPath(new URL('../../api', import.meta.url)),
      input: user.password,
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
}
