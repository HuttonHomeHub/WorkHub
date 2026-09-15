import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

/**
 * Writes the API's OpenAPI contract (default `openapi.json`) without listening
 * or connecting to a database — run it via `pnpm contract:generate` from the
 * repo root (ADR-0017). CI regenerates the contract and fails on any diff, so
 * the committed spec and the client types generated from it match the code.
 */
async function main(): Promise<void> {
  // A tooling entry point, not app code. Config validation requires a
  // DATABASE_URL, but nothing connects: modules are never initialised. Set it
  // before importing AppModule, because ConfigModule validates on import.
  process.env.DATABASE_URL ??= 'postgresql://openapi@localhost:5432/openapi';
  process.env.LOG_LEVEL = 'silent';

  const { AppModule } = await import('./app.module');
  const { configureApp } = await import('./app.setup');
  const { createOpenApiDocument } = await import('./common/openapi/document');

  const app = await NestFactory.create(AppModule, { logger: false, bodyParser: false });
  configureApp(app);
  const document = createOpenApiDocument(app);
  writeFileSync(
    resolve(process.argv[2] ?? 'openapi.json'),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
