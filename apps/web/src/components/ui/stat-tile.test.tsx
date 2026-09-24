import { render, screen } from '@testing-library/react';
import { Clock3 } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { StatTile } from './stat-tile';

describe('StatTile', () => {
  it('is a term and its figure, with the detail read as part of the figure', () => {
    render(
      <dl>
        <StatTile label="Credited" icon={Clock3} value="39:00" detail="of 37:30 target" />
      </dl>,
    );
    expect(screen.getByRole('term')).toHaveTextContent('Credited');
    expect(screen.getByRole('definition')).toHaveTextContent('39:00 of 37:30 target');
  });

  it('shows a placeholder while the figure loads', () => {
    render(
      <dl>
        <StatTile label="Credited" value={undefined} />
      </dl>,
    );
    expect(screen.getByRole('definition').querySelector('[aria-hidden]')).not.toBeNull();
  });
});
