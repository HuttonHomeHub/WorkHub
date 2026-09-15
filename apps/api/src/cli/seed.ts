import { assertSeedAllowed, DEV_USER, upsertAccount } from './accounts';
import { runWithAuthContext } from './bootstrap';

/**
 * Development seed (ADR-0018): ensures a known account exists so you can sign
 * in straight away (`pnpm db:seed`, run by scripts/setup.sh). Refuses to run
 * when NODE_ENV=production. Safe to re-run — an existing dev account has its
 * password reset to the documented one.
 */
async function main(): Promise<void> {
  assertSeedAllowed(process.env.NODE_ENV);
  await runWithAuthContext(async (ctx) => {
    const { created } = await upsertAccount(ctx, DEV_USER);
    process.stdout.write(
      `${created ? 'Created' : 'Reset'} the dev account — sign in with ${DEV_USER.email} / ${DEV_USER.password}\n`,
    );
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
