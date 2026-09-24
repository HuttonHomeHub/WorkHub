import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FlexiValue } from './flexi-value';

describe('FlexiValue', () => {
  it.each([
    [90, '+1:30 over', 'text-success-text', 'over'],
    [-120, '−2:00 under', 'text-warning-text', 'under'],
    [0, '0:00', null, 'level'],
  ] as const)(
    'shows %i minutes as "%s", its direction in words as well as colour',
    (minutes, text, colour, direction) => {
      render(<FlexiValue minutes={minutes} />);
      const value = screen.getByText(text);
      expect(value).toHaveAttribute('data-direction', direction);
      if (colour) expect(value).toHaveClass(colour);
      else expect(value.className).not.toMatch(/text-(success|warning)-text/);
    },
  );
});
