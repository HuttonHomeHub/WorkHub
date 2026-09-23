import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Principal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Paginated } from '../../../common/dto/paginated';
import { ApiDataResponse, ApiPaginatedResponse } from '../../../common/openapi/api-responses';
import { ParseUuidPipe } from '../../../common/validation/uuid';

import { CreateExcessConversionDto } from './dto/create-excess-conversion.dto';
import { ExcessConversionResponseDto } from './dto/excess-conversion-response.dto';
import { ListExcessConversionsQueryDto } from './dto/list-excess-conversions-query.dto';
import { ExcessConversionsService } from './excess-conversions.service';

/**
 * Excess conversions HTTP surface. Thin: it validates input (DTOs + global pipe),
 * delegates to the service, maps entities to safe response DTOs, and sets
 * status codes. Authentication is global (deny by default); ownership
 * authorisation lives in the service (ADR-0016). Responses are documented in
 * the `{ data, meta }` envelope the interceptor adds (ADR-0017). Versioned
 * under `/api/v1` (see docs/API.md).
 */
@ApiTags('Hours')
@ApiCookieAuth()
@Controller({ path: 'excess-conversions', version: '1' })
export class ExcessConversionsController {
  constructor(private readonly service: ExcessConversionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Switch a week's excess conversion on" })
  @ApiDataResponse(ExcessConversionResponseDto, HttpStatus.CREATED)
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreateExcessConversionDto,
  ): Promise<ExcessConversionResponseDto> {
    return ExcessConversionResponseDto.from(await this.service.create(user, dto));
  }

  @Get()
  @ApiOperation({ summary: 'List the weeks whose conversion is on (cursor-paginated)' })
  @ApiPaginatedResponse(ExcessConversionResponseDto)
  async list(
    @CurrentUser() user: Principal,
    @Query() query: ListExcessConversionsQueryDto,
  ): Promise<Paginated<ExcessConversionResponseDto>> {
    const { items, meta } = await this.service.list(user, query);
    return new Paginated(
      items.map((item) => ExcessConversionResponseDto.from(item)),
      meta,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Switch a week's excess conversion off" })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}
