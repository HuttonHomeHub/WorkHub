import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('keeps its label on one line by default', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('whitespace-nowrap', 'h-9');
  });

  it('lets a long label wrap, growing from its size’s height, when asked', () => {
    render(
      <Button wrap size="sm">
        Add England and Wales bank holidays for 2026
      </Button>,
    );
    const button = screen.getByRole('button', {
      name: 'Add England and Wales bank holidays for 2026',
    });
    expect(button).toHaveClass('whitespace-normal', 'h-auto', 'min-h-8');
    expect(button).not.toHaveClass('whitespace-nowrap');
    expect(button).not.toHaveClass('h-8');
  });
});
