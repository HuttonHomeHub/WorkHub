import { PASSWORD_MIN_LENGTH } from '@repo/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SignUpForm } from './sign-up-form';

const signUpEmail = vi.fn();

vi.mock('../api/auth-client', () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) as unknown },
  },
}));

function renderForm(onSuccess = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SignUpForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

/** The form stays covered while public sign-up is off by default (ADR-0018). */
describe('SignUpForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows accessible validation errors, including the shared password rule', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Password'), 'x'.repeat(PASSWORD_MIN_LENGTH - 1));
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText(`Use at least ${PASSWORD_MIN_LENGTH} characters.`)).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('submits the details and calls onSuccess', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ error: null });
    const { onSuccess } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(signUpEmail).toHaveBeenCalledWith({
      name: 'New User',
      email: 'new@example.com',
      password: 'a-strong-password',
    });
  });

  it("shows the server's message when sign-up is rejected", async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ error: { message: 'Email sign up is not enabled' } });
    const { onSuccess } = renderForm();

    await user.type(screen.getByLabelText('Name'), 'New User');
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'a-strong-password');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email sign up is not enabled');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
