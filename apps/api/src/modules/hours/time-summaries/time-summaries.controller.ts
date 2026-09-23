import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Principal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiDataListResponse, ApiDataResponse } from '../../../common/openapi/api-responses';

import { SummaryGroupDto, TimeBalancesDto } from './dto/summary-responses.dto';
import { TimeBalancesQueryDto } from './dto/time-balances-query.dto';
import { TimeSummariesQueryDto } from './dto/time-summaries-query.dto';
import { HoursCalculationService } from './hours-calculation.service';

/**
 * `GET /api/v1/time-summaries`: computed totals by day, week or month
 * (ADR-0020 §4). 422 for a range over 366 days or `to` not after `from`.
 */
@ApiTags('Hours')
@ApiCookieAuth()
@Controller({ path: 'time-summaries', version: '1' })
export class TimeSummariesController {
  constructor(private readonly hours: HoursCalculationService) {}

  @Get()
  @ApiOperation({ summary: 'Totals by day, week or month for a date range (computed)' })
  @ApiDataListResponse(SummaryGroupDto)
  async list(
    @CurrentUser() user: Principal,
    @Query() query: TimeSummariesQueryDto,
  ): Promise<SummaryGroupDto[]> {
    return this.hours.summaries(user, query);
  }
}

/** `GET /api/v1/time-balances`: flexi, TOIL, leave and overtime as of a date. */
@ApiTags('Hours')
@ApiCookieAuth()
@Controller({ path: 'time-balances', version: '1' })
export class TimeBalancesController {
  constructor(private readonly hours: HoursCalculationService) {}

  @Get()
  @ApiOperation({ summary: 'Balances as of a date (computed)' })
  @ApiDataResponse(TimeBalancesDto)
  async get(
    @CurrentUser() user: Principal,
    @Query() query: TimeBalancesQueryDto,
  ): Promise<TimeBalancesDto> {
    return this.hours.balances(user, query.asOf);
  }
}
