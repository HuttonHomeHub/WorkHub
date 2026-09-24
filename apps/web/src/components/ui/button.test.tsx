import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('keeps its label on one line by default, at the 32px control height', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'whitespace-nowrap',
      'h-(--control-md)',
      'focus-ring',
    );
  });

  it.each([
    ['sm', 'h-(--control-sm)'],
    ['default', 'h-(--control-md)'],
    ['lg', 'h-(--control-lg)'],
    ['icon', 'size-(--icon-button)'],
  ] as const)('renders the %s size from the density tokens', (size, height) => {
    render(
      <Button size={size} aria-label="Go">
        Go
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass(height);
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
    expect(button).toHaveClass('whitespace-normal', 'h-auto', 'min-h-(--control-sm)');
    expect(button).not.toHaveClass('whitespace-nowrap');
    expect(button).not.toHaveClass('h-(--control-sm)');
  });

  it('while pending, keeps its name, shows a spinner, is busy and cannot be pressed again', async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button isPending onClick={onClick}>
        Save new terms
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save new terms' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();

    rerender(<Button onClick={onClick}>Save new terms</Button>);
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button.querySelector('[data-slot="spinner"]')).toBeNull();
  });

  it('renders its styling on a link with asChild', () => {
    render(
      <Button asChild variant="outline">
        <a href="/hours/summary">Summary</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Summary' })).toHaveClass('border-input');
  });
});
