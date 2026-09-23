import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from './alert-dialog';

function Harness({ onDiscard }: { onDiscard: () => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Leave
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>Your changes will be lost.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={onDiscard}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

describe('AlertDialog', () => {
  it('is labelled by its title, focuses Cancel, and returns focus on Escape', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(<Harness onDiscard={onDiscard} />);
    const trigger = screen.getByRole('button', { name: 'Leave' });
    await user.click(trigger);

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard changes?' });
    expect(dialog).toHaveAccessibleDescription('Your changes will be lost.');
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('keeps focus on its buttons and runs the action', async () => {
    const user = userEvent.setup();
    const onDiscard = vi.fn();
    render(<Harness onDiscard={onDiscard} />);
    await user.click(screen.getByRole('button', { name: 'Leave' }));
    await screen.findByRole('alertdialog');
    await user.tab();
    expect(screen.getByRole('button', { name: 'Discard changes' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();
    await user.tab({ shift: true });
    await user.keyboard('{Enter}');
    expect(onDiscard).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
