import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProgressBar } from './progress';

function fill(container: HTMLElement): HTMLElement {
  return container.firstElementChild!.firstElementChild as HTMLElement;
}

describe('ProgressBar', () => {
  it('is decorative: the figure beside it carries the meaning', () => {
    const { container } = render(<ProgressBar value={1110} max={2250} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('fills in proportion, in the accent, until the whole is reached', () => {
    const { container, rerender } = render(<ProgressBar value={1110} max={2250} />);
    expect(fill(container).style.width).toBe('49.3%');
    expect(fill(container)).toHaveClass('bg-primary');

    rerender(<ProgressBar value={2430} max={2250} />);
    expect(fill(container).style.width).toBe('100%');
    expect(fill(container)).toHaveClass('bg-success');
    expect(container.firstElementChild).toHaveAttribute('data-complete', 'true');
  });

  it('shows empty when there is nothing to reach', () => {
    const { container } = render(<ProgressBar value={60} max={0} />);
    expect(fill(container).style.width).toBe('0%');
    expect(container.firstElementChild).not.toHaveAttribute('data-complete');
  });
});
