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
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Principal } from '../../common/auth/principal';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Paginated } from '../../common/dto/paginated';
import { ParseUuidPipe } from '../../common/validation/uuid';

import { CreateReferenceItemDto } from './dto/create-reference-item.dto';
import { ListReferenceItemsQueryDto } from './dto/list-reference-items-query.dto';
import { ReferenceItemResponseDto } from './dto/reference-item-response.dto';
import { UpdateReferenceItemDto } from './dto/update-reference-item.dto';
import { ReferenceService } from './reference.service';

/**
 * Reference feature HTTP surface — the controller template. Thin: it validates
 * input (DTOs + global pipe), delegates to the service, maps entities to safe
 * response DTOs, and sets status codes. Authentication is global (deny by
 * default); ownership authorisation lives in the service (ADR-0016).
 * Versioned under `/api/v1` (see docs/API.md).
 */
@ApiTags('reference')
@ApiCookieAuth()
@Controller({ path: 'reference-items', version: '1' })
export class ReferenceController {
  constructor(private readonly service: ReferenceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a reference item (owned by the caller)' })
  @ApiCreatedResponse({ type: ReferenceItemResponseDto })
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreateReferenceItemDto,
  ): Promise<ReferenceItemResponseDto> {
    return ReferenceItemResponseDto.from(await this.service.create(user, dto));
  }

  @Get()
  @ApiOperation({ summary: "List the caller's reference items (cursor-paginated)" })
  @ApiOkResponse({ type: ReferenceItemResponseDto, isArray: true })
  async list(
    @CurrentUser() user: Principal,
    @Query() query: ListReferenceItemsQueryDto,
  ): Promise<Paginated<ReferenceItemResponseDto>> {
    const { items, meta } = await this.service.list(user, query);
    return new Paginated(
      items.map((item) => ReferenceItemResponseDto.from(item)),
      meta,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the caller’s reference items by id' })
  @ApiOkResponse({ type: ReferenceItemResponseDto })
  async getById(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<ReferenceItemResponseDto> {
    return ReferenceItemResponseDto.from(await this.service.getById(user, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a reference item (optimistic locking)' })
  @ApiOkResponse({ type: ReferenceItemResponseDto })
  async update(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateReferenceItemDto,
  ): Promise<ReferenceItemResponseDto> {
    return ReferenceItemResponseDto.from(await this.service.update(user, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a reference item' })
  @ApiNoContentResponse()
  async remove(
    @CurrentUser() user: Principal,
    @Param('id', ParseUuidPipe) id: string,
  ): Promise<void> {
    await this.service.remove(user, id);
  }
}
