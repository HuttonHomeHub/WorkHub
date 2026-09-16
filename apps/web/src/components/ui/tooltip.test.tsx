import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

function renderTooltip() {
  render(
    <TooltipProvider delayDuration={0}>
      <button type="button">Before</button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Collapse sidebar">
            <svg aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent>Collapse sidebar</TooltipContent>
      </Tooltip>
    </TooltipProvider>,
  );
}

describe('Tooltip', () => {
  it('opens when its trigger receives keyboard focus and closes on Escape', async () => {
    const user = userEvent.setup();
    renderTooltip();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab();
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(trigger).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Collapse sidebar');

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('opens on hover', async () => {
    const user = userEvent.setup();
    renderTooltip();
    await user.hover(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Collapse sidebar');
  });

  it('closes when focus leaves the trigger', async () => {
    const user = userEvent.setup();
    renderTooltip();
    await user.tab();
    await user.tab();
    await screen.findByRole('tooltip');
    await user.tab({ shift: true });
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });
});
