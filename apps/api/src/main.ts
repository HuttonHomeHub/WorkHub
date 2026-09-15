import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createOpenApiDocument } from './common/openapi/document';
import { AppConfigService } from './config/app-config.service';

/**
 * API bootstrap. Wires the security, versioning, logging, and OpenAPI concerns
 * described in docs/BACKEND_ARCHITECTURE.md, then starts the HTTP server.
 */
async function bootstrap(): Promise<void> {
  // bodyParser: false — configureApp mounts Better Auth first, then JSON parsing.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get(AppConfigService);

  // Route framework logs through Pino (structured + correlated).
  app.useLogger(app.get(Logger));
  app.flushLogs();

  configureApp(app);

  // Drain in-flight work on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // OpenAPI UI — served outside production only. The committed contract is
  // apps/api/openapi.json (`pnpm contract:generate`, ADR-0017).
  if (!config.isProduction) {
    SwaggerModule.setup('api/docs', app, createOpenApiDocument(app));
  }

  await app.listen(config.port);
}

void bootstrap();
