import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, USER_NAME_MAX_LENGTH } from '@repo/types';
import { z } from 'zod';

/** Validation for the sign-in form (ADR-0007). */
export const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Validation for the sign-up form. The limits come from `@repo/types`, the
 * same constants the API's Better Auth configuration enforces (ADR-0017).
 */
export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(USER_NAME_MAX_LENGTH, `Use at most ${USER_NAME_MAX_LENGTH} characters.`),
  email: z.email('Enter a valid email address.'),
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
    .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
