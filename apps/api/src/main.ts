import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { configureApp } from './app.setup';
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

  // OpenAPI — served outside production only. Better Auth's own endpoints
  // (/api/auth/*) are documented in docs/API.md.
  if (!config.isProduction) {
    const openapi = new DocumentBuilder()
      .setTitle('Blank App API')
      .setDescription('Blank App REST API')
      .setVersion('1.0')
      .addCookieAuth('better-auth.session_token')
      .build();
    const document = SwaggerModule.createDocument(app, openapi);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.port);
}

void bootstrap();
