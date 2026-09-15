import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from '@repo/types';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';

import type { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';

/** DI token for the Better Auth instance. */
export const AUTH_INSTANCE = Symbol('AUTH_INSTANCE');

/**
 * Better Auth validates password length itself but not the display name, so
 * enforce the shared limit server-side too — the web form's check is UX only.
 */
function assertValidName(name: unknown): void {
  if (name === undefined) return;
  const length = typeof name === 'string' ? name.trim().length : 0;
  if (length === 0 || length > USER_NAME_MAX_LENGTH) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- APIError extends Error at runtime; its declared type hides that
    throw new APIError('BAD_REQUEST', {
      message: `Name must be between 1 and ${USER_NAME_MAX_LENGTH} characters.`,
    });
  }
}

/**
 * Builds the Better Auth instance (ADR-0003). Open email/password signup for
 * individual accounts (ADR-0016) — no organisations, no roles.
 *
 * - Sessions are stored in Postgres via the Prisma adapter and carried in a
 *   secure, http-only cookie; `getSession` validates it server-side.
 * - `generateId: false` delegates primary-key generation to the schema's
 *   UUID v7 defaults (docs/DATABASE.md).
 * - Account rules (password and name lengths) come from `@repo/types`, shared
 *   with the web forms (ADR-0017).
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
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      // Email verification requires an SMTP integration — see docs/adr/0016.
    },
    databaseHooks: {
      user: {
        create: {
          before: (user) => {
            assertValidName(user.name);
            return Promise.resolve();
          },
        },
        update: {
          before: (user) => {
            assertValidName(user.name);
            return Promise.resolve();
          },
        },
      },
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
