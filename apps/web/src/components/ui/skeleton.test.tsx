import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('is hidden from assistive technology and takes the given size', () => {
    const { container } = render(<Skeleton className="h-8" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstChild).toHaveClass('h-8');
  });
});
