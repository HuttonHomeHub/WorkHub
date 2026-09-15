import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

/**
 * Builds the OpenAPI document. Shared by the dev server (`/api/docs`) and the
 * contract generator (`generate-openapi.ts`) so both describe the same API.
 * Better Auth's own endpoints (`/api/auth/*`) are outside the Nest router and
 * are documented in docs/API.md instead.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('WorkHub API')
    .setDescription('WorkHub REST API')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();
  return SwaggerModule.createDocument(app, config);
}
