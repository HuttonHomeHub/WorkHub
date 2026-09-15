import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Principal } from '../common/auth/principal';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiDataResponse } from '../common/openapi/api-responses';

import { MeResponseDto } from './dto/me-response.dto';

/**
 * The authenticated user's own profile. The one live protected endpoint the
 * base app ships: it demonstrates the deny-by-default guard + principal
 * injection, and gives the web client a typed "who am I" call.
 */
@ApiTags('me')
@ApiCookieAuth()
@Controller({ path: 'me', version: '1' })
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiDataResponse(MeResponseDto)
  getMe(@CurrentUser() user: Principal): MeResponseDto {
    return MeResponseDto.from(user);
  }
}
