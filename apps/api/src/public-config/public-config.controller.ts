import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { ApiDataResponse } from '../common/openapi/api-responses';
import { AppConfigService } from '../config/app-config.service';

import { PublicConfigResponseDto } from './dto/public-config-response.dto';

/**
 * Public, unauthenticated settings the web client needs to render the
 * signed-out screens (e.g. whether to offer sign-up). Only non-sensitive flags
 * belong here.
 */
@ApiTags('config')
@Controller({ path: 'config', version: '1' })
export class PublicConfigController {
  constructor(private readonly config: AppConfigService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get public client configuration' })
  @ApiDataResponse(PublicConfigResponseDto)
  getConfig(): PublicConfigResponseDto {
    return { signUpEnabled: this.config.authSignUpEnabled };
  }
}
