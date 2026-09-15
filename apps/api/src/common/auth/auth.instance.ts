import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';

import type { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';

/** DI token for the Better Auth instance. */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

/**
 * Builds the Better Auth instance (ADR-0003). Open email/password signup for
 * individual accounts (ADR-0016) — no organisations, no roles.
 *
 * - Sessions are stored in Postgres via the Prisma adapter and carried in a
 *   secure, http-only cookie; `getSession` validates it server-side.
 * - `generateId: false` delegates primary-key generation to the schema's
 *   UUID v7 defaults (docs/DATABASE.md).
 * - Better Auth's own endpoints are mounted at `/api/auth/*` in `app.setup.ts`,
 *   before the Nest router and body parser — so the Nest throttler never sees
 *   them. Better Auth's built-in limiter protects them instead (stricter rules
 *   for sign-in/sign-up), keyed by client IP resolved through the trusted
 *   proxies (docs/SECURITY_STANDARDS.md → Rate limiting).
 */
export function createAuth(prisma: PrismaService, config: AppConfigService) {
  const trustedProxies = config.authTrustedProxies;
  return betterAuth({
    baseURL: config.betterAuthUrl,
    secret: config.betterAuthSecret,
    trustedOrigins: config.corsOrigins,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      // Email verification requires an SMTP integration — see docs/adr/0016.
    },
    rateLimit: {
      enabled: config.authRateLimitEnabled,
    },
    advanced: {
      database: { generateId: false },
      ...(trustedProxies.length > 0 ? { ipAddress: { trustedProxies } } : {}),
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
