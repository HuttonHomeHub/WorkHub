import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { AuthRequestError, useSignIn } from '../api/session';
import { signInSchema, type SignInInput } from '../schemas/auth';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';

interface SignInFormProps {
  /** Called after a successful sign-in (the route navigates). */
  onSuccess: () => void;
}

/**
 * Only a 401 means the email or password was wrong. Anything else (a rejected
 * origin, the API being down, …) gets a neutral message — blaming the
 * credentials for those sends people chasing the wrong problem. The real cause
 * is in the API log.
 */
function signInErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) {
    if (error.status === 401) return 'Wrong email or password. Try again.';
    if (error.status === 429) return 'Too many sign-in attempts. Wait a minute and try again.';
  }
  return "We couldn't sign you in right now. Try again in a moment.";
}

export function SignInForm({ onSuccess }: SignInFormProps) {
  const signIn = useSignIn();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (input: SignInInput) => {
    signIn.mutate(input, { onSuccess });
  };

  return (
    <Form {...form}>
      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises -- RHF handleSubmit returns a promise by design */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {signIn.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{signInErrorMessage(signIn.error)}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={signIn.isPending}>
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </Form>
  );
}
