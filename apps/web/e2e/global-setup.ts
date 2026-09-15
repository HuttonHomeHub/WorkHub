import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { E2E_USER } from './fixtures';

/**
 * Public sign-up is off by default (ADR-0018), so the journeys sign in with an
 * account created — or reset — through the API's account CLI. Runs after
 * Playwright's webServer has started the API, whose dev build provides
 * `dist/cli/user.js`. Needs DATABASE_URL (CI env, or the repo-root .env).
 */
export default function globalSetup(): void {
  execFileSync(
    'node',
    [
      '--env-file-if-exists=../../.env',
      'dist/cli/user.js',
      'create',
      '--email',
      E2E_USER.email,
      '--name',
      E2E_USER.name,
      '--password-stdin',
      '--upsert',
    ],
    {
      cwd: fileURLToPath(new URL('../../api', import.meta.url)),
      input: E2E_USER.password,
      stdio: ['pipe', 'inherit', 'inherit'],
    },
  );
}
