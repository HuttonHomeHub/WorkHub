import { z } from 'zod';

/** `openssl rand -base64 32` yields 44 characters; 32 is the production floor. */
export const PRODUCTION_SECRET_MIN_LENGTH = 32;

/** Substrings of example/placeholder secrets that must never reach production. */
const PLACEHOLDER_SECRET_MARKERS = ['dev-insecure', 'change-me', 'changeme', '<openssl', 'example'];

/**
 * Environment schema — the single source of truth for configuration shape.
 * The app validates the environment at startup and refuses to boot on invalid
 * config (fail fast). See docs/BACKEND_ARCHITECTURE.md (Configuration).
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3000),
    /** PostgreSQL connection string (postgresql://…). */
    DATABASE_URL: z.string().min(1),
    /**
     * Comma-separated trusted origins (CORS + Better Auth's origin check). The
     * default covers the Vite dev server over http and https (VS Code port
     * forwarding may serve https://localhost).
     */
    CORS_ORIGINS: z.string().default('http://localhost:5173,https://localhost:5173'),
    /** Session signing secret — must be strong in production. */
    BETTER_AUTH_SECRET: z.string().min(16).default('dev-insecure-secret-change-me!!'),
    BETTER_AUTH_URL: z.string().min(1).default('http://localhost:3000'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    /** Rate limiting: window (seconds) and max requests per window. */
    RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(100),
    /**
     * Better Auth's own rate limiter for /api/auth/* (those routes bypass the
     * Nest throttler). Unset = Better Auth's default: on in production only.
     */
    AUTH_RATE_LIMIT_ENABLED: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === 'true')),
    /**
     * Comma-separated reverse-proxy IPs/CIDRs whose X-Forwarded-For hops are
     * skipped when resolving the client IP. Without it, a multi-hop chain
     * (your proxy → web nginx → api) resolves to no IP and every client
     * shares one auth rate-limit bucket.
     */
    AUTH_TRUSTED_PROXIES: z.string().default(''),
    /**
     * Public self-service sign-up (ADR-0018). Off by default: accounts are
     * created with `pnpm user:create`. Set true for apps anyone may join.
     */
    AUTH_SIGNUP_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Sessions are signed with this secret: never boot production with a
    // short one or a copied placeholder (the dev default, .env.example).
    const secret = env.BETTER_AUTH_SECRET;
    if (secret.length < PRODUCTION_SECRET_MIN_LENGTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: `BETTER_AUTH_SECRET must be at least ${PRODUCTION_SECRET_MIN_LENGTH} characters in production (generate one with \`openssl rand -base64 32\`).`,
      });
    }
    const lowered = secret.toLowerCase();
    if (PLACEHOLDER_SECRET_MARKERS.some((marker) => lowered.includes(marker))) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message:
          'BETTER_AUTH_SECRET is a placeholder; set a random secret in production (`openssl rand -base64 32`).',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Validate raw environment variables into a typed `Env`.
 * Passed to `ConfigModule.forRoot({ validate })`.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}
