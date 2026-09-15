import { Controller, Get } from '@nestjs/common';
import { ApiProperty, DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ApiDataResponse, ApiPaginatedResponse } from './api-responses';

class WidgetDto {
  @ApiProperty()
  id!: string;
}

@Controller('widgets')
class WidgetsController {
  @Get()
  @ApiPaginatedResponse(WidgetDto)
  list(): void {}

  @Get(':id')
  @ApiDataResponse(WidgetDto)
  getById(): void {}
}

async function buildDocument(): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule({ controllers: [WidgetsController] }).compile();
  const app = moduleRef.createNestApplication();
  const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());
  await app.close();
  return document;
}

/** The spec must describe the envelope TransformInterceptor adds (ADR-0017). */
describe('OpenAPI envelope decorators', () => {
  it('documents a single resource inside { data }', async () => {
    const document = await buildDocument();

    expect(document.paths['/widgets/{id}']?.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            required: ['data'],
            properties: { data: { $ref: '#/components/schemas/WidgetDto' } },
          },
        },
      },
    });
    expect(document.components?.schemas).toHaveProperty('WidgetDto');
  });

  it('documents a list as { data: [], meta: PageMeta }', async () => {
    const document = await buildDocument();

    expect(document.paths['/widgets']?.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            required: ['data', 'meta'],
            properties: {
              data: { type: 'array', items: { $ref: '#/components/schemas/WidgetDto' } },
              meta: { $ref: '#/components/schemas/PageMetaDto' },
            },
          },
        },
      },
    });
  });
});
