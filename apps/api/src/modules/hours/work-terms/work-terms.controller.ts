import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Principal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Paginated } from '../../../common/dto/paginated';
import { ApiDataResponse, ApiPaginatedResponse } from '../../../common/openapi/api-responses';
import { ParseUuidPipe } from '../../../common/validation/uuid';

import { CreateWorkTermDto } from './dto/create-work-term.dto';
import { ListWorkTermsQueryDto } from './dto/list-work-terms-query.dto';
import { UpdateWorkTermDto } from './dto/update-work-term.dto';
import { WorkTermResponseDto } from './dto/work-term-response.dto';
import { WorkTermsService } from './work-terms.service';

/**
 * Work terms HTTP surface. Thin: it validates input (DTOs + global pipe),
 * delegates to the service, maps entities to safe response DTOs, and sets
 * status codes. Authentication is global (deny by default); ownership
 * authorisation lives in the service (ADR-0016). Responses are documented in
 * the `{ data, meta }` envelope the interceptor adds (ADR-0017). Versioned
 * under `/api/v1` (see docs/API.md).
 */
@ApiTags('Hours')
@ApiCookieAuth()
@Controller({ path: 'work-terms', version: '1' })
export class WorkTermsController {
  constructor(private readonly service: WorkTermsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create work terms, effective from a Monday' })
  @ApiDataResponse(WorkTermResponseDto, HttpStatus.CREATED)
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreateWorkTermDto,
  ): Promise<WorkTermResponseDto> {
    return WorkTermResponseDto.from(await this.service.create(user, dto));
  }

  @Get()
  @ApiOperation({ summary: "List the caller's work terms, latest first (cursor-paginated)" })
  @ApiPaginatedResponse(WorkTermResponseDto)
  async list(
    @CurrentUser() user: Principal,
    @Query() query: ListWorkTermsQueryDto,
  ): Promise<Paginated<WorkTermResponseDto>> {
    const { items, meta } = await this.service.list(user, query);
    return new Paginated(
      items.map((item) => WorkTermResponseDto.from(item)),
      meta,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the caller’s work terms by id' })
  @ApiDataResponse(WorkTermResponseDto)
  async getById(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<WorkTermResponseDto> {
    return WorkTermResponseDto.from(await this.service.getById(user, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a work term (optimistic locking)' })
  @ApiDataResponse(WorkTermResponseDto)
  async update(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateWorkTermDto,
  ): Promise<WorkTermResponseDto> {
    return WorkTermResponseDto.from(await this.service.update(user, id, dto));
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted work term (undo a delete)' })
  @ApiDataResponse(WorkTermResponseDto)
  async restore(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<WorkTermResponseDto> {
    return WorkTermResponseDto.from(await this.service.restore(user, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete work terms (422 for the last remaining terms)' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}
