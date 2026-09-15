import { NestFactory } from '@nestjs/core';

import type { AuthInstance } from '../common/auth/auth.instance';

import type { AccountAuthContext } from './accounts';

/**
 * Boots the API's module graph without an HTTP server and hands Better Auth's
 * context to `task` (ADR-0018). Configuration comes from the environment; the
 * package scripts load the repo-root `.env` when it exists. Always exits the
 * process: the logger's worker thread would otherwise keep it alive.
 */
export async function runWithAuthContext(
  task: (ctx: AccountAuthContext) => Promise<void>,
): Promise<never> {
  process.env.LOG_LEVEL ??= 'warn';
  // Imported lazily: ConfigModule validates the environment on import.
  const { AppModule } = await import('../app.module');
  const { AUTH_INSTANCE } = await import('../common/auth/auth.instance');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  let exitCode = 0;
  try {
    const auth = app.get<AuthInstance>(AUTH_INSTANCE);
    await task(await auth.$context);
  } catch (error: unknown) {
    exitCode = 1;
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  } finally {
    await app.close();
  }
  process.exit(exitCode);
}
