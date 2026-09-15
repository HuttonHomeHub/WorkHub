import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { SignInForm } from './sign-in-form';

const signInEmail = vi.fn();

vi.mock('../api/auth-client', () => ({
  authClient: {
    signIn: { email: (...args: unknown[]) => signInEmail(...args) as unknown },
  },
}));

function renderForm(onSuccess = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <SignInForm onSuccess={onSuccess} />
    </QueryClientProvider>,
  );
  return { onSuccess };
}

describe('SignInForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows accessible validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('submits credentials and calls onSuccess', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ error: null });
    const { onSuccess } = renderForm();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'password-123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(signInEmail).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password-123',
    });
  });

  async function submitAndGetAlert() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'some-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    return screen.findByRole('alert');
  }

  it('says the credentials are wrong only when the server returns 401', async () => {
    signInEmail.mockResolvedValue({
      error: {
        status: 401,
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      },
    });
    const { onSuccess } = renderForm();

    expect(await submitAndGetAlert()).toHaveTextContent('Wrong email or password');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // Regression: a rejected origin (403) used to show "Wrong email or password",
  // sending the user after a password problem that didn't exist.
  it('does not blame the credentials when the request is rejected for another reason', async () => {
    signInEmail.mockResolvedValue({
      error: { status: 403, code: 'INVALID_ORIGIN', message: 'Invalid origin' },
    });
    renderForm();

    const alert = await submitAndGetAlert();
    expect(alert).toHaveTextContent("We couldn't sign you in right now");
    expect(alert).not.toHaveTextContent('Wrong email or password');
  });

  it('explains rate limiting (429)', async () => {
    signInEmail.mockResolvedValue({
      error: { status: 429, message: 'Too many requests. Please try again later.' },
    });
    renderForm();

    expect(await submitAndGetAlert()).toHaveTextContent('Too many sign-in attempts');
  });
});
