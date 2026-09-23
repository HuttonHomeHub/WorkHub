import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dismissToast, toast, Toaster } from './toast';

function renderToaster() {
  render(
    <>
      <button type="button">Delete terms</button>
      <Toaster label="Notifications" dismissLabel="Dismiss notification" />
    </>,
  );
}

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    act(() => dismissToast());
    vi.useRealTimers();
  });

  it('announces a success toast politely, in a named region, then hides it after 4s', async () => {
    renderToaster();
    act(() => {
      toast({ title: 'Terms saved' });
    });

    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    expect(await screen.findByText('Terms saved')).toBeInTheDocument();
    // Radix mirrors the text into a polite live region for screen readers.
    const polite = document.querySelector('[aria-live="polite"]');
    expect(polite).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(3_900);
    });
    expect(screen.getByText('Terms saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText('Terms saved')).not.toBeInTheDocument();
  });

  it('keeps an error toast until it is dismissed', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    renderToaster();
    act(() => {
      toast({ variant: 'error', title: "We couldn't delete the terms" });
    });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("We couldn't delete the terms")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText("We couldn't delete the terms")).not.toBeInTheDocument();
  });

  it('keeps an undo toast for 8s, with the action reachable by Tab and never taking focus', async () => {
    const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
    const onUndo = vi.fn();
    renderToaster();
    const trigger = screen.getByRole('button', { name: 'Delete terms' });
    trigger.focus();
    act(() => {
      toast({
        title: 'Terms deleted',
        action: { label: 'Undo', altText: 'Undo deleting the terms', onAction: onUndo },
      });
    });
    expect(await screen.findByText('Terms deleted')).toBeInTheDocument();
    expect(trigger).toHaveFocus();

    act(() => {
      vi.advanceTimersByTime(6_000);
    });
    expect(screen.getByText('Terms deleted')).toBeInTheDocument();

    // The toaster follows the page in the tab order: from the trigger, Tab
    // reaches the toast and then its Undo within three stops.
    const undo = screen.getByRole('button', { name: 'Undo' });
    let stops = 0;
    while (document.activeElement !== undo && stops < 3) {
      await user.tab();
      stops += 1;
    }
    expect(undo).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Terms deleted')).not.toBeInTheDocument();
  });

  it('hides an undo toast after 8s', async () => {
    renderToaster();
    act(() => {
      toast({
        title: 'Holiday deleted',
        action: { label: 'Undo', altText: 'Undo deleting the holiday', onAction: vi.fn() },
      });
    });
    expect(await screen.findByText('Holiday deleted')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(8_100);
    });
    expect(screen.queryByText('Holiday deleted')).not.toBeInTheDocument();
  });
});
