import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './context-menu';

function renderRow() {
  const onClear = vi.fn();
  render(
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div data-testid="row">
          Mon 5 Oct
          <button type="button">Actions for Mon 5 Oct</button>
          <input aria-label="Start, Mon 5 Oct" onContextMenu={(event) => event.stopPropagation()} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onClear}>Clear day</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>,
  );
  return { onClear };
}

describe('ContextMenu', () => {
  it('opens on right-click, runs an item from the keyboard and closes', async () => {
    const user = userEvent.setup();
    const { onClear } = renderRow();
    fireEvent.contextMenu(screen.getByTestId('row'));
    expect(await screen.findByRole('menuitem', { name: 'Clear day' })).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onClear).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('opens from a focused control (Shift+F10 raises contextmenu there) and closes on Escape', async () => {
    const user = userEvent.setup();
    renderRow();
    const button = screen.getByRole('button', { name: 'Actions for Mon 5 Oct' });
    button.focus();
    fireEvent.contextMenu(button);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it("leaves a text field's own menu alone", () => {
    renderRow();
    fireEvent.contextMenu(screen.getByRole('textbox', { name: 'Start, Mon 5 Oct' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
