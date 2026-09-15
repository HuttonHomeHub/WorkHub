import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiProperty, ApiResponse, getSchemaPath } from '@nestjs/swagger';

/** OpenAPI shape of cursor-pagination metadata (`PageMeta` in `@repo/types`). */
export class PageMetaDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor for the next page; null on the last page.',
  })
  nextCursor!: string | null;

  @ApiProperty()
  hasMore!: boolean;
}

/**
 * Documents a success response inside the standard `{ data }` envelope that
 * `TransformInterceptor` adds at runtime, so the OpenAPI contract — and the
 * client types generated from it (ADR-0017) — describe what is actually sent.
 * Use instead of `@ApiOkResponse({ type })`, which omits the envelope.
 */
export function ApiDataResponse(
  model: Type<unknown>,
  status: HttpStatus.OK | HttpStatus.CREATED = HttpStatus.OK,
) {
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: getSchemaPath(model) } },
      },
    }),
  );
}

/** Documents a cursor-paginated list: `{ data: Model[], meta: PageMeta }`. */
export function ApiPaginatedResponse(model: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(model, PageMetaDto),
    ApiResponse({
      status: HttpStatus.OK,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(PageMetaDto) },
        },
      },
    }),
  );
}
