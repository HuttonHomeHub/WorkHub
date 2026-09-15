import { z } from 'zod';

/** Validation for the sign-in form (ADR-0007). */
export const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Validation for the sign-up form. The 8-character minimum mirrors the API's
 * Better Auth policy — keep the two in step.
 */
export const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(120, 'Use at most 120 characters.'),
  email: z.email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
