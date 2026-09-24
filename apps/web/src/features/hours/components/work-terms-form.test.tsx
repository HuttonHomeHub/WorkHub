import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { workTermsFormValues } from '../schemas/settings';

import { WorkTermsForm } from './work-terms-form';

function renderForm(mode: 'create' | 'edit' = 'create') {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <WorkTermsForm
      mode={mode}
      defaultValues={workTermsFormValues('2026-10-05', null)}
      isPending={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />,
  );
  return { onSubmit, onCancel };
}

describe('WorkTermsForm', () => {
  it('shows the weekday grid with labelled target and minimum fields', () => {
    renderForm();
    const grid = screen.getByRole('table');
    expect(within(grid).getByRole('columnheader', { name: /Flexi target/ })).toHaveTextContent(
      'counts towards flexi',
    );
    expect(within(grid).getByRole('columnheader', { name: /Minimum/ })).toHaveTextContent(
      'warning only',
    );
    expect(screen.getByLabelText('Monday flexi target')).toHaveValue('7:30');
    expect(screen.getByLabelText('Friday minimum')).toHaveValue('5:30');
    expect(screen.getByLabelText('Saturday flexi target')).toHaveValue('');
  });

  it('describes paid overtime and starts with it off', () => {
    renderForm();
    const paid = screen.getByRole('switch', { name: 'Paid overtime allowed' });
    expect(paid).toHaveAttribute('aria-checked', 'false');
    expect(paid).toHaveAccessibleDescription('When off, all overtime is recorded as unpaid.');
  });

  it('submits the terms in minutes', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.clear(screen.getByLabelText('Friday flexi target'));
    await user.type(screen.getByLabelText('Friday flexi target'), '6h');
    await user.clear(screen.getByLabelText('Friday minimum'));
    await user.click(screen.getByRole('switch', { name: 'Paid overtime allowed' }));
    await user.click(screen.getByRole('button', { name: 'Save new terms' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [values] = onSubmit.mock.calls[0] as [Record<string, unknown>];
    expect(values).toMatchObject({
      effectiveFrom: '2026-10-05',
      targetMinutes: { fri: 360, sat: null },
      minimumMinutes: { fri: null },
      paidOvertimeAllowed: true,
    });
  });

  it('has a conversion block, 0:30 by default, that submits in minutes', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const block = screen.getByLabelText('Conversion block');
    expect(block).toHaveValue('0:30');
    expect(block).toHaveAccessibleDescription(
      expect.stringContaining(
        'Conversion turns whole blocks into TOIL and overtime; the rest stays as flexi. Default 0:30.',
      ),
    );

    await user.clear(block);
    await user.type(block, '15m');
    await user.click(screen.getByRole('button', { name: 'Save new terms' }));
    const [values] = onSubmit.mock.calls[0] as [Record<string, unknown>];
    expect(values).toMatchObject({ conversionBlockMinutes: 15 });
  });

  it('flags a conversion block of 0:00', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const block = screen.getByLabelText('Conversion block');
    await user.clear(block);
    await user.type(block, '0');
    await user.click(screen.getByRole('button', { name: 'Save new terms' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(block).toHaveAccessibleDescription(expect.stringContaining('Enter more than 0:00.'));
  });

  it('flags a minimum above its target, linked to the field, and focuses the first error', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const target = screen.getByLabelText('Tuesday flexi target');
    await user.clear(target);
    await user.type(target, '6:00');
    await user.click(screen.getByRole('button', { name: 'Save new terms' }));

    const minimum = screen.getByLabelText('Tuesday minimum');
    expect(minimum).toHaveAttribute('aria-invalid', 'true');
    expect(minimum).toHaveAccessibleDescription(/Use at most the flexi target, 6:00\./);
    expect(minimum).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags a date that is not a Monday', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    const date = screen.getByLabelText('Applies from');
    await user.clear(date);
    await user.type(date, '2026-10-07');
    await user.click(screen.getByRole('button', { name: 'Save new terms' }));
    expect(
      await screen.findByText('Choose a Monday: terms start with a week.'),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the date read-only when editing, and cancels', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderForm('edit');
    expect(screen.getByLabelText('Applies from')).toHaveAttribute('readonly');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
