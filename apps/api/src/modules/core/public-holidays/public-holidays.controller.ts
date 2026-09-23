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

import { CreatePublicHolidayDto } from './dto/create-public-holiday.dto';
import { ListPublicHolidaysQueryDto } from './dto/list-public-holidays-query.dto';
import { PublicHolidayResponseDto } from './dto/public-holiday-response.dto';
import { UpdatePublicHolidayDto } from './dto/update-public-holiday.dto';
import { PublicHolidaysService } from './public-holidays.service';

/**
 * Public holidays HTTP surface. Thin: it validates input (DTOs + global pipe),
 * delegates to the service, maps entities to safe response DTOs, and sets
 * status codes. Authentication is global (deny by default); ownership
 * authorisation lives in the service (ADR-0016). Responses are documented in
 * the `{ data, meta }` envelope the interceptor adds (ADR-0017). Versioned
 * under `/api/v1` (see docs/API.md).
 */
@ApiTags('Core')
@ApiCookieAuth()
@Controller({ path: 'public-holidays', version: '1' })
export class PublicHolidaysController {
  constructor(private readonly service: PublicHolidaysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a public holiday (owned by the caller)' })
  @ApiDataResponse(PublicHolidayResponseDto, HttpStatus.CREATED)
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreatePublicHolidayDto,
  ): Promise<PublicHolidayResponseDto> {
    return PublicHolidayResponseDto.from(await this.service.create(user, dto));
  }

  @Get()
  @ApiOperation({ summary: "List the caller's public holidays (cursor-paginated)" })
  @ApiPaginatedResponse(PublicHolidayResponseDto)
  async list(
    @CurrentUser() user: Principal,
    @Query() query: ListPublicHolidaysQueryDto,
  ): Promise<Paginated<PublicHolidayResponseDto>> {
    const { items, meta } = await this.service.list(user, query);
    return new Paginated(
      items.map((item) => PublicHolidayResponseDto.from(item)),
      meta,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the caller’s public holidays by id' })
  @ApiDataResponse(PublicHolidayResponseDto)
  async getById(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<PublicHolidayResponseDto> {
    return PublicHolidayResponseDto.from(await this.service.getById(user, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a public holiday (optimistic locking)' })
  @ApiDataResponse(PublicHolidayResponseDto)
  async update(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdatePublicHolidayDto,
  ): Promise<PublicHolidayResponseDto> {
    return PublicHolidayResponseDto.from(await this.service.update(user, id, dto));
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted public holiday (undo a delete)' })
  @ApiDataResponse(PublicHolidayResponseDto)
  async restore(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<PublicHolidayResponseDto> {
    return PublicHolidayResponseDto.from(await this.service.restore(user, id));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a public holiday' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}
