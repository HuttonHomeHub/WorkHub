import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Alert, AlertDescription } from './alert';

describe('Alert', () => {
  it('announces an error at once, as an alert', () => {
    render(
      <Alert variant="destructive">
        <AlertDescription>We couldn&apos;t load the week.</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the week.");
  });

  it.each(['default', 'info'] as const)(
    'announces a %s message politely, as a status',
    (variant) => {
      render(
        <Alert variant={variant}>
          <AlertDescription>Nothing is tracked this week.</AlertDescription>
        </Alert>,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Nothing is tracked this week.');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('lets the caller choose the role', () => {
    render(
      <Alert variant="info" role="alert">
        <AlertDescription>Your session is about to end.</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
