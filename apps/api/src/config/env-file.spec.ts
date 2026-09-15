import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ENV_FILE_PATH } from './env-file';

describe('ENV_FILE_PATH', () => {
  // Regression: `pnpm dev` started the API without DATABASE_URL because nothing
  // loaded the root .env. It must sit next to .env.example, which setup.sh copies.
  it('points at the repository root, beside .env.example', () => {
    const apiPackageDir = resolve(__dirname, '../..');

    expect(existsSync(resolve(apiPackageDir, `${ENV_FILE_PATH}.example`))).toBe(true);
  });
});
