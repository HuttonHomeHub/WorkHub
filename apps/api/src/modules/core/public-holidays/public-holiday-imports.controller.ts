import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Principal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiDataResponse } from '../../../common/openapi/api-responses';

import {
  CreatePublicHolidayImportDto,
  PublicHolidayImportResponseDto,
} from './dto/public-holiday-import.dto';
import { PublicHolidayResponseDto } from './dto/public-holiday-response.dto';
import { PublicHolidaysService } from './public-holidays.service';

/**
 * `POST /api/v1/public-holiday-imports`: add a year's bundled England and Wales
 * bank holidays (docs/features/hours-tracker.md → API). An import is a
 * sub-resource action, not a stored row: 201 when it added holidays, 200 when
 * the year was already complete, 422 for a year outside the bundle.
 */
@ApiTags('Core')
@ApiCookieAuth()
@Controller({ path: 'public-holiday-imports', version: '1' })
export class PublicHolidayImportsController {
  constructor(private readonly service: PublicHolidaysService) {}

  @Post()
  @ApiOperation({
    summary: "Add a year's England and Wales bank holidays the caller does not already have",
  })
  @ApiDataResponse(PublicHolidayImportResponseDto, HttpStatus.CREATED)
  @ApiDataResponse(PublicHolidayImportResponseDto, HttpStatus.OK)
  async create(
    @CurrentUser() user: Principal,
    @Body() dto: CreatePublicHolidayImportDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicHolidayImportResponseDto> {
    const added = await this.service.importYear(user, dto.year);
    response.status(added.length > 0 ? HttpStatus.CREATED : HttpStatus.OK);
    return { year: dto.year, added: added.map((row) => PublicHolidayResponseDto.from(row)) };
  }
}
