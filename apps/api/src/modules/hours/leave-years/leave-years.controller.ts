import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Principal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Paginated } from '../../../common/dto/paginated';
import { ApiDataResponse, ApiPaginatedResponse } from '../../../common/openapi/api-responses';
import { ParseUuidPipe } from '../../../common/validation/uuid';

import { CreateLeaveYearDto } from './dto/create-leave-year.dto';
import { LeaveYearResponseDto } from './dto/leave-year-response.dto';
import { ListLeaveYearsQueryDto } from './dto/list-leave-years-query.dto';
import { UpdateLeaveYearDto } from './dto/update-leave-year.dto';
import { LeaveYearsService } from './leave-years.service';

/**
 * Leave years HTTP surface. Thin: it validates input (DTOs + global pipe),
 * delegates to the service, maps entities to safe response DTOs, and sets
 * status codes. Authentication is global (deny by default); ownership
 * authorisation lives in the service (ADR-0016). Responses are documented in
 * the `{ data, meta }` envelope the interceptor adds (ADR-0017). Versioned
 * under `/api/v1` (see docs/API.md).
 */
@ApiTags('Hours')
@ApiCookieAuth()
@Controller({ path: 'leave-years', version: '1' })
export class LeaveYearsController {
  constructor(private readonly service: LeaveYearsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create the settings for a leave year (one per year)' })
  @ApiDataResponse(LeaveYearResponseDto, HttpStatus.CREATED)
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreateLeaveYearDto,
  ): Promise<LeaveYearResponseDto> {
    return LeaveYearResponseDto.from(await this.service.create(user, dto));
  }

  @Get()
  @ApiOperation({ summary: "List the caller's leave years (cursor-paginated)" })
  @ApiPaginatedResponse(LeaveYearResponseDto)
  async list(
    @CurrentUser() user: Principal,
    @Query() query: ListLeaveYearsQueryDto,
  ): Promise<Paginated<LeaveYearResponseDto>> {
    const { items, meta } = await this.service.list(user, query);
    return new Paginated(
      items.map((item) => LeaveYearResponseDto.from(item)),
      meta,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the caller’s leave years by id' })
  @ApiDataResponse(LeaveYearResponseDto)
  async getById(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<LeaveYearResponseDto> {
    return LeaveYearResponseDto.from(await this.service.getById(user, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a leave year (optimistic locking)' })
  @ApiDataResponse(LeaveYearResponseDto)
  async update(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateLeaveYearDto,
  ): Promise<LeaveYearResponseDto> {
    return LeaveYearResponseDto.from(await this.service.update(user, id, dto));
  }
}
