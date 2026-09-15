/**
 * The repository-root `.env` created by `scripts/setup.sh`, relative to the API
 * package directory that `pnpm dev`, the CLI scripts, and tests run from. Nest's
 * ConfigModule skips a missing file and never overrides variables already in the
 * environment, so containers and CI keep using their real environment.
 */
export const ENV_FILE_PATH = '../../.env';
