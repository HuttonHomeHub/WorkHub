import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from './env.validation';

/**
 * Typed accessor for validated configuration. Product code depends on this,
 * never on `process.env` directly (see docs/BACKEND_ARCHITECTURE.md).
 */
@Injectable()
export class AppConfigService {
  // `true` marks the config as validated, so `get` returns non-undefined values.
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.config.get('API_PORT', { infer: true });
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.config.get('LOG_LEVEL', { infer: true });
  }

  get betterAuthSecret(): string {
    return this.config.get('BETTER_AUTH_SECRET', { infer: true });
  }

  get betterAuthUrl(): string {
    return this.config.get('BETTER_AUTH_URL', { infer: true });
  }

  get corsOrigins(): string[] {
    return this.config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  /** Public self-service sign-up (ADR-0018); off unless AUTH_SIGNUP_ENABLED=true. */
  get authSignUpEnabled(): boolean {
    return this.config.get('AUTH_SIGNUP_ENABLED', { infer: true });
  }

  /** `undefined` defers to Better Auth's default (enabled in production). */
  get authRateLimitEnabled(): boolean | undefined {
    return this.config.get('AUTH_RATE_LIMIT_ENABLED', { infer: true });
  }

  get authTrustedProxies(): string[] {
    return this.config
      .get('AUTH_TRUSTED_PROXIES', { infer: true })
      .split(',')
      .map((proxy) => proxy.trim())
      .filter(Boolean);
  }

  get rateLimit(): { ttlMs: number; limit: number } {
    return {
      ttlMs: this.config.get('RATE_LIMIT_TTL', { infer: true }) * 1000,
      limit: this.config.get('RATE_LIMIT_LIMIT', { infer: true }),
    };
  }
}
