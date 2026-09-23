import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDelayedFlag } from './use-delayed-flag';

describe('useDelayedFlag', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('turns on only after 300ms of activity, and off at once', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active), {
      initialProps: { active: true },
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('never turns on for a load that ends before 300ms', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
  });
});
