import { describe, expect, it } from 'vitest';

import { signInSchema, signUpSchema } from './auth';

describe('auth schemas', () => {
  it('accepts valid sign-in input', () => {
    const result = signInSchema.safeParse({ email: 'a@b.co', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = signInSchema.safeParse({ email: 'nope', password: 'x' });
    expect(result.success).toBe(false);
  });

  it('enforces the minimum password length on sign-up (mirrors the API policy)', () => {
    const short = signUpSchema.safeParse({ name: 'A', email: 'a@b.co', password: '1234567' });
    expect(short.success).toBe(false);
    const ok = signUpSchema.safeParse({ name: 'A', email: 'a@b.co', password: '12345678' });
    expect(ok.success).toBe(true);
  });

  it('requires a non-empty, trimmed name', () => {
    const result = signUpSchema.safeParse({ name: '   ', email: 'a@b.co', password: '12345678' });
    expect(result.success).toBe(false);
  });
});
