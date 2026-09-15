import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.validation';

const DATABASE_URL = 'postgresql://app:app@localhost:5432/app_test?schema=public';
const STRONG_SECRET = 'q3Vt9xLr2bN8mZp4Kc7Wd1Hs6Jf0Ga5Ye+Uo/Ti=';

describe('validateEnv', () => {
  // Regression: only secrets containing `dev-insecure` were rejected, so the
  // `.env.example` placeholder booted in production.
  describe('BETTER_AUTH_SECRET', () => {
    it('accepts the built-in development default outside production', () => {
      const env = validateEnv({ NODE_ENV: 'development', DATABASE_URL });

      expect(env.BETTER_AUTH_SECRET).toContain('dev-insecure');
    });

    it.each([
      'change-me-in-every-environment-and-then-some',
      'CHANGEME-please-set-a-real-secret-value-here',
      '<openssl rand -base64 32> placeholder value here',
      'an-example-secret-that-is-long-enough-to-pass',
      'dev-insecure-secret-change-me-padded-to-length',
    ])('rejects the placeholder %j in production', (secret) => {
      expect(() =>
        validateEnv({ NODE_ENV: 'production', DATABASE_URL, BETTER_AUTH_SECRET: secret }),
      ).toThrow(/BETTER_AUTH_SECRET is a placeholder/);
    });

    it('rejects the development default in production', () => {
      expect(() => validateEnv({ NODE_ENV: 'production', DATABASE_URL })).toThrow(
        /BETTER_AUTH_SECRET/,
      );
    });

    it('rejects a secret shorter than 32 characters in production', () => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DATABASE_URL,
          BETTER_AUTH_SECRET: 'aB3dE5gH7jK9mN1pQ3sT5vX7z', // 25 chars
        }),
      ).toThrow(/at least 32 characters/);
    });

    it('accepts a strong random secret in production', () => {
      const env = validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL,
        BETTER_AUTH_SECRET: STRONG_SECRET,
      });

      expect(env.BETTER_AUTH_SECRET).toBe(STRONG_SECRET);
    });
  });
});
