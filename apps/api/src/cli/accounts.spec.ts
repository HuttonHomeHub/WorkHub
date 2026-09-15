import { PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AccountError,
  assertSeedAllowed,
  createAccount,
  resetPassword,
  upsertAccount,
  type AccountAuthContext,
} from './accounts';

const USER_ID = '018f4e8a-9a1b-7c2d-8e3f-4a5b6c7d8e9f';

function makeContext(existing: { accounts: { providerId: string }[] } | null = null) {
  const internalAdapter = {
    findUserByEmail: vi.fn().mockResolvedValue(existing && { user: { id: USER_ID }, ...existing }),
    createUser: vi.fn().mockResolvedValue({ id: USER_ID }),
    linkAccount: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn().mockResolvedValue(undefined),
    deleteUserSessions: vi.fn().mockResolvedValue(undefined),
  };
  const password = { hash: vi.fn((plain: string) => Promise.resolve(`hashed:${plain}`)) };
  return { ctx: { internalAdapter, password } satisfies AccountAuthContext, internalAdapter };
}

/** Server-side account management without email (ADR-0018). */
describe('accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAccount', () => {
    it('creates a user with a hashed credential account', async () => {
      const { ctx, internalAdapter } = makeContext();

      const result = await createAccount(ctx, {
        email: '  Owner@Example.com ',
        name: ' Owner ',
        password: 'a-strong-password',
      });

      expect(result).toEqual({ userId: USER_ID });
      expect(internalAdapter.createUser).toHaveBeenCalledWith(
        { email: 'owner@example.com', name: 'Owner', emailVerified: false },
        { method: 'email-password' },
      );
      expect(internalAdapter.linkAccount).toHaveBeenCalledWith({
        userId: USER_ID,
        providerId: 'credential',
        accountId: USER_ID,
        password: 'hashed:a-strong-password',
      });
    });

    it('refuses an email that already has an account', async () => {
      const { ctx, internalAdapter } = makeContext({ accounts: [] });

      await expect(
        createAccount(ctx, {
          email: 'owner@example.com',
          name: 'Owner',
          password: 'a-strong-password',
        }),
      ).rejects.toThrow('already exists');
      expect(internalAdapter.createUser).not.toHaveBeenCalled();
    });

    it.each([
      [{ email: 'not-an-email', name: 'Owner', password: 'a-strong-password' }, 'valid email'],
      [
        {
          email: 'owner@example.com',
          name: 'Owner',
          password: 'x'.repeat(PASSWORD_MIN_LENGTH - 1),
        },
        'Password must be',
      ],
      [
        {
          email: 'owner@example.com',
          name: 'x'.repeat(USER_NAME_MAX_LENGTH + 1),
          password: 'a-strong-password',
        },
        'Name must be',
      ],
    ])('rejects invalid input (%o) with the shared rules', async (input, message) => {
      const { ctx, internalAdapter } = makeContext();

      await expect(createAccount(ctx, input)).rejects.toThrow(AccountError);
      await expect(createAccount(ctx, input)).rejects.toThrow(message);
      expect(internalAdapter.createUser).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('replaces the credential password and signs out every session', async () => {
      const { ctx, internalAdapter } = makeContext({ accounts: [{ providerId: 'credential' }] });

      await resetPassword(ctx, { email: 'owner@example.com', password: 'a-new-password' });

      expect(internalAdapter.findUserByEmail).toHaveBeenCalledWith('owner@example.com', {
        includeAccounts: true,
      });
      expect(internalAdapter.updatePassword).toHaveBeenCalledWith(USER_ID, 'hashed:a-new-password');
      expect(internalAdapter.deleteUserSessions).toHaveBeenCalledWith(USER_ID);
    });

    it('adds a credential account when the user has none', async () => {
      const { ctx, internalAdapter } = makeContext({ accounts: [{ providerId: 'github' }] });

      await resetPassword(ctx, { email: 'owner@example.com', password: 'a-new-password' });

      expect(internalAdapter.updatePassword).not.toHaveBeenCalled();
      expect(internalAdapter.linkAccount).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'credential', password: 'hashed:a-new-password' }),
      );
    });

    it('fails for an unknown email without touching sessions', async () => {
      const { ctx, internalAdapter } = makeContext();

      await expect(
        resetPassword(ctx, { email: 'nobody@example.com', password: 'a-new-password' }),
      ).rejects.toThrow('No account exists');
      expect(internalAdapter.deleteUserSessions).not.toHaveBeenCalled();
    });
  });

  describe('upsertAccount', () => {
    it('creates a missing account', async () => {
      const { ctx } = makeContext();
      const input = { email: 'dev@example.com', name: 'Dev', password: 'dev-password-123' };
      await expect(upsertAccount(ctx, input)).resolves.toEqual({ userId: USER_ID, created: true });
    });

    it('resets the password of an existing account', async () => {
      const { ctx, internalAdapter } = makeContext({ accounts: [{ providerId: 'credential' }] });
      const input = { email: 'dev@example.com', name: 'Dev', password: 'dev-password-123' };

      await expect(upsertAccount(ctx, input)).resolves.toEqual({ userId: USER_ID, created: false });
      expect(internalAdapter.updatePassword).toHaveBeenCalled();
      expect(internalAdapter.createUser).not.toHaveBeenCalled();
    });
  });

  describe('assertSeedAllowed', () => {
    it('refuses to seed in production', () => {
      expect(() => assertSeedAllowed('production')).toThrow(AccountError);
    });

    it.each(['development', 'test', undefined])('allows seeding when NODE_ENV=%s', (nodeEnv) => {
      expect(() => assertSeedAllowed(nodeEnv)).not.toThrow();
    });
  });
});
