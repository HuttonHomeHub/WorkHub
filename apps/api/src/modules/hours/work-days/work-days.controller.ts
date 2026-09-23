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

import { CreateWorkDayDto } from './dto/create-work-day.dto';
import { ListWorkDaysQueryDto } from './dto/list-work-days-query.dto';
import { UpdateWorkDayDto } from './dto/update-work-day.dto';
import { WorkDayResponseDto } from './dto/work-day-response.dto';
import { WorkDaysService } from './work-days.service';

/**
 * Work days HTTP surface. Thin: it validates input (DTOs + global pipe),
 * delegates to the service, maps entities to safe response DTOs, and sets
 * status codes. Authentication is global (deny by default); ownership
 * authorisation lives in the service (ADR-0016). Responses are documented in
 * the `{ data, meta }` envelope the interceptor adds (ADR-0017). Versioned
 * under `/api/v1` (see docs/API.md).
 */
@ApiTags('Hours')
@ApiCookieAuth()
@Controller({ path: 'work-days', version: '1' })
export class WorkDaysController {
  constructor(private readonly service: WorkDaysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a work day (owned by the caller)' })
  @ApiDataResponse(WorkDayResponseDto, HttpStatus.CREATED)
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreateWorkDayDto,
  ): Promise<WorkDayResponseDto> {
    return WorkDayResponseDto.from(await this.service.create(user, dto));
  }

  @Get()
  @ApiOperation({ summary: "List the caller's work days (cursor-paginated)" })
  @ApiPaginatedResponse(WorkDayResponseDto)
  async list(
    @CurrentUser() user: Principal,
    @Query() query: ListWorkDaysQueryDto,
  ): Promise<Paginated<WorkDayResponseDto>> {
    const { items, meta } = await this.service.list(user, query);
    return new Paginated(
      items.map((item) => WorkDayResponseDto.from(item)),
      meta,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the caller’s work days by id' })
  @ApiDataResponse(WorkDayResponseDto)
  async getById(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<WorkDayResponseDto> {
    return WorkDayResponseDto.from(await this.service.getById(user, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a work day (optimistic locking)' })
  @ApiDataResponse(WorkDayResponseDto)
  async update(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateWorkDayDto,
  ): Promise<WorkDayResponseDto> {
    return WorkDayResponseDto.from(await this.service.update(user, id, dto));
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted work day (undo a delete)' })
  @ApiDataResponse(WorkDayResponseDto)
  async restore(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<WorkDayResponseDto> {
    return WorkDayResponseDto.from(await this.service.restore(user, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a work day' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}
