import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';

import { AuthContextService } from './auth-context.service';
import { AUTH_INSTANCE, createAuth } from './auth.instance';

/**
 * Global module exposing the Better Auth instance and the authentication seam
 * ({@link AuthContextService}). Global so the authentication guard can resolve
 * the principal anywhere, and so `main.ts` can mount the auth HTTP handler.
 */
@Global()
@Module({
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [PrismaService, AppConfigService],
      useFactory: createAuth,
    },
    AuthContextService,
  ],
  exports: [AUTH_INSTANCE, AuthContextService],
})
export class AuthModule {}
