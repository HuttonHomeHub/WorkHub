import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Label } from './label';
import { Switch } from './switch';

describe('Switch', () => {
  it('is a named switch that Space toggles, keeping focus', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <>
        <Switch id="paid" onCheckedChange={onCheckedChange} />
        <Label htmlFor="paid">Paid overtime allowed</Label>
      </>,
    );
    const control = screen.getByRole('switch', { name: 'Paid overtime allowed' });
    expect(control).toHaveAttribute('aria-checked', 'false');

    await user.tab();
    expect(control).toHaveFocus();
    await user.keyboard(' ');
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);
    expect(control).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(control).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles when its label is clicked', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Switch id="bought" />
        <Label htmlFor="bought">Bought leave</Label>
      </>,
    );
    await user.click(screen.getByText('Bought leave'));
    expect(screen.getByRole('switch', { name: 'Bought leave' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('does nothing while disabled', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Bought leave" disabled onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole('switch', { name: 'Bought leave' }));
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
