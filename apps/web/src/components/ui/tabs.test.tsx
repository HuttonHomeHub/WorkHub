import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

function ControlledTabs({ onChange = vi.fn() }: { onChange?: (value: string) => void }) {
  const [value, setValue] = React.useState('one');
  return (
    <>
      <button type="button">Before</button>
      <Tabs
        value={value}
        onValueChange={(next) => {
          onChange(next);
          setValue(next);
        }}
      >
        <TabsList aria-label="Sections">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
          <TabsTrigger value="three">Three</TabsTrigger>
        </TabsList>
        <TabsContent value="one">First panel</TabsContent>
        <TabsContent value="two">Second panel</TabsContent>
        <TabsContent value="three">Third panel</TabsContent>
      </Tabs>
    </>
  );
}

describe('Tabs', () => {
  it('shows the selected tab and only its panel', () => {
    render(<ControlledTabs />);
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('First panel');
    expect(screen.queryByText('Second panel')).not.toBeInTheDocument();
  });

  it('is one tab stop: Tab enters on the selected tab, then leaves for the panel', async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);
    await user.tab();
    await user.tab();
    expect(screen.getByRole('tab', { name: 'One' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('tabpanel')).toHaveFocus();
  });

  it('moves and activates with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledTabs onChange={onChange} />);
    screen.getByRole('tab', { name: 'One' }).focus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveFocus();
    expect(onChange).toHaveBeenLastCalledWith('two');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Second panel');

    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus();
  });

  it('selects a tab on click', async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);
    await user.click(screen.getByRole('tab', { name: 'Three' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Third panel');
  });
});
