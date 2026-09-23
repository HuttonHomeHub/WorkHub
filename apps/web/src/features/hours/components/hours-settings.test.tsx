import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HoursSettings } from './hours-settings';

import { on, page, renderWithApi, stubApi } from '@/test/api-stub';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HoursSettings', () => {
  it('opens the tab the URL names, and reports tab changes for the URL', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();
    stubApi(on('GET', '/api/v1/leave-years', () => page([])));
    renderWithApi(
      <HoursSettings tab="leave" onTabChange={onTabChange} year={2026} onYearChange={vi.fn()} />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Hours settings' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Leave' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('heading', { name: 'Leave years' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Holidays' }));
    expect(onTabChange).toHaveBeenCalledWith('holidays');
  });
});
