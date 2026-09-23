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

import { CreateTimeAdjustmentDto } from './dto/create-time-adjustment.dto';
import { ListTimeAdjustmentsQueryDto } from './dto/list-time-adjustments-query.dto';
import { TimeAdjustmentResponseDto } from './dto/time-adjustment-response.dto';
import { UpdateTimeAdjustmentDto } from './dto/update-time-adjustment.dto';
import { TimeAdjustmentsService } from './time-adjustments.service';

/**
 * Time adjustments HTTP surface. Thin: it validates input (DTOs + global pipe),
 * delegates to the service, maps entities to safe response DTOs, and sets
 * status codes. Authentication is global (deny by default); ownership
 * authorisation lives in the service (ADR-0016). Responses are documented in
 * the `{ data, meta }` envelope the interceptor adds (ADR-0017). Versioned
 * under `/api/v1` (see docs/API.md).
 */
@ApiTags('Hours')
@ApiCookieAuth()
@Controller({ path: 'time-adjustments', version: '1' })
export class TimeAdjustmentsController {
  constructor(private readonly service: TimeAdjustmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a time adjustment (owned by the caller)' })
  @ApiDataResponse(TimeAdjustmentResponseDto, HttpStatus.CREATED)
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreateTimeAdjustmentDto,
  ): Promise<TimeAdjustmentResponseDto> {
    return TimeAdjustmentResponseDto.from(await this.service.create(user, dto));
  }

  @Get()
  @ApiOperation({ summary: "List the caller's time adjustments (cursor-paginated)" })
  @ApiPaginatedResponse(TimeAdjustmentResponseDto)
  async list(
    @CurrentUser() user: Principal,
    @Query() query: ListTimeAdjustmentsQueryDto,
  ): Promise<Paginated<TimeAdjustmentResponseDto>> {
    const { items, meta } = await this.service.list(user, query);
    return new Paginated(
      items.map((item) => TimeAdjustmentResponseDto.from(item)),
      meta,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the caller’s time adjustments by id' })
  @ApiDataResponse(TimeAdjustmentResponseDto)
  async getById(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TimeAdjustmentResponseDto> {
    return TimeAdjustmentResponseDto.from(await this.service.getById(user, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a time adjustment (optimistic locking)' })
  @ApiDataResponse(TimeAdjustmentResponseDto)
  async update(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateTimeAdjustmentDto,
  ): Promise<TimeAdjustmentResponseDto> {
    return TimeAdjustmentResponseDto.from(await this.service.update(user, id, dto));
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted time adjustment (undo a delete)' })
  @ApiDataResponse(TimeAdjustmentResponseDto)
  async restore(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<TimeAdjustmentResponseDto> {
    return TimeAdjustmentResponseDto.from(await this.service.restore(user, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a time adjustment' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}
