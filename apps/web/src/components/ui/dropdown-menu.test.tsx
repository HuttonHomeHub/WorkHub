import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

function renderMenu() {
  const onClear = vi.fn();
  const onMark = vi.fn();
  render(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions for Mon 5 Oct">
          ⋯
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onClear}>Clear day</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onMark}>Mark bank holiday as worked</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  return {
    onClear,
    onMark,
    trigger: screen.getByRole('button', { name: 'Actions for Mon 5 Oct' }),
  };
}

describe('DropdownMenu', () => {
  it('opens from the keyboard on the first item, moves with arrows and runs with Enter', async () => {
    const user = userEvent.setup();
    const { onMark, trigger } = renderMenu();
    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Clear day' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Mark bank holiday as worked' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onMark).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on Escape and returns focus to its trigger', async () => {
    const user = userEvent.setup();
    const { onClear, trigger } = renderMenu();
    await user.click(trigger);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onClear).not.toHaveBeenCalled();
  });

  it('closes on Tab, back on its trigger, and hides nothing behind it', async () => {
    const user = userEvent.setup();
    const { trigger } = renderMenu();
    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    // Non-modal: the trigger is not hidden from assistive technology.
    expect(trigger.closest('[aria-hidden="true"]')).toBeNull();
    await user.tab();
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('moves to an item by typing its first letter', async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('menu');
    await user.keyboard('m');
    expect(screen.getByRole('menuitem', { name: 'Mark bank holiday as worked' })).toHaveFocus();
  });
});
