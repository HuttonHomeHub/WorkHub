import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it.each(['default', 'outline', 'warning', 'info'] as const)(
    'renders the %s variant with its text',
    (variant) => {
      render(<Badge variant={variant}>Below minimum</Badge>);
      const badge = screen.getByText('Below minimum');
      expect(badge.tagName).toBe('SPAN');
      expect(badge).not.toHaveAttribute('tabindex');
    },
  );

  it('passes attributes and merges classes', () => {
    render(
      <Badge className="ml-2" title="Two days">
        Day not recorded
      </Badge>,
    );
    const badge = screen.getByText('Day not recorded');
    expect(badge).toHaveAttribute('title', 'Two days');
    expect(badge.className).toContain('ml-2');
  });
});
