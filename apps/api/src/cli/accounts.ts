import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from '@repo/types';
import { z } from 'zod';

/**
 * Account management without email (ADR-0018): create an account and reset a
 * password from the server, using Better Auth's own password hashing and
 * storage so the result is identical to a normal sign-up. Used by the `user`
 * CLI, the dev seed, and tests; kept free of Nest so it is easy to test.
 */

/** The parts of Better Auth's context (`auth.$context`) this module relies on. */
export interface AccountAuthContext {
  password: { hash: (password: string) => Promise<string> };
  internalAdapter: {
    findUserByEmail: (
      email: string,
      options?: { includeAccounts: boolean },
    ) => Promise<{ user: { id: string }; accounts: { providerId: string }[] } | null>;
    createUser: (
      user: { email: string; name: string; emailVerified: boolean },
      source: { method: 'email-password' },
    ) => Promise<{ id: string }>;
    linkAccount: (account: {
      userId: string;
      providerId: string;
      accountId: string;
      password: string;
    }) => Promise<unknown>;
    updatePassword: (userId: string, password: string) => Promise<void>;
    deleteUserSessions: (userId: string) => Promise<void>;
  };
}

/** A user-facing problem with the requested account change. */
export class AccountError extends Error {}

export interface AccountInput {
  email: string;
  name: string;
  password: string;
}

/** Better Auth's provider id for email/password accounts. */
const CREDENTIAL_PROVIDER = 'credential';

const emailSchema = z.email();

function normaliseEmail(email: string): string {
  const normalised = email.trim().toLowerCase();
  if (!emailSchema.safeParse(normalised).success) {
    throw new AccountError(`"${email}" is not a valid email address.`);
  }
  return normalised;
}

function assertPassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new AccountError(
      `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`,
    );
  }
}

function normaliseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > USER_NAME_MAX_LENGTH) {
    throw new AccountError(`Name must be between 1 and ${USER_NAME_MAX_LENGTH} characters.`);
  }
  return trimmed;
}

/** Creates an email/password account. Fails if the email is already registered. */
export async function createAccount(
  ctx: AccountAuthContext,
  input: AccountInput,
): Promise<{ userId: string }> {
  const email = normaliseEmail(input.email);
  const name = normaliseName(input.name);
  assertPassword(input.password);
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new AccountError(`An account for ${email} already exists.`);
  }

  // Hash first so a hashing failure can't leave a user without credentials.
  const hash = await ctx.password.hash(input.password);
  // The same provisioning source Better Auth's own email/password sign-up passes.
  const user = await ctx.internalAdapter.createUser(
    { email, name, emailVerified: false },
    { method: 'email-password' },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: CREDENTIAL_PROVIDER,
    accountId: user.id,
    password: hash,
  });
  return { userId: user.id };
}

/** Replaces an account's password and signs out all of its existing sessions. */
export async function resetPassword(
  ctx: AccountAuthContext,
  input: Pick<AccountInput, 'email' | 'password'>,
): Promise<{ userId: string }> {
  const email = normaliseEmail(input.email);
  assertPassword(input.password);
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  if (!found) throw new AccountError(`No account exists for ${email}.`);

  const userId = found.user.id;
  const hash = await ctx.password.hash(input.password);
  if (found.accounts.some((account) => account.providerId === CREDENTIAL_PROVIDER)) {
    await ctx.internalAdapter.updatePassword(userId, hash);
  } else {
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: CREDENTIAL_PROVIDER,
      accountId: userId,
      password: hash,
    });
  }
  // Whoever knew the old password may still hold a session — end them all.
  await ctx.internalAdapter.deleteUserSessions(userId);
  return { userId };
}

/** Creates the account, or resets its password if it exists (seeding, test set-up). */
export async function upsertAccount(
  ctx: AccountAuthContext,
  input: AccountInput,
): Promise<{ userId: string; created: boolean }> {
  if (await ctx.internalAdapter.findUserByEmail(normaliseEmail(input.email))) {
    return { ...(await resetPassword(ctx, input)), created: false };
  }
  return { ...(await createAccount(ctx, input)), created: true };
}

/** The documented development account created by `pnpm db:seed`. Never used in production. */
export const DEV_USER: AccountInput = {
  email: 'dev@example.com',
  name: 'Dev User',
  password: 'dev-password-123',
};

export function assertSeedAllowed(nodeEnv: string | undefined): void {
  if (nodeEnv === 'production') {
    throw new AccountError('Refusing to seed the development account when NODE_ENV=production.');
  }
}
