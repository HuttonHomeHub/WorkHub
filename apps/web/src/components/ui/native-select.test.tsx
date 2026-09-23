import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { NativeSelect } from './native-select';

describe('NativeSelect', () => {
  it('is a labelled combobox whose value the keyboard changes', async () => {
    const user = userEvent.setup();
    render(
      <>
        <label htmlFor="balance">Balance</label>
        <NativeSelect id="balance" defaultValue="FLEXI">
          <option value="FLEXI">Flexi</option>
          <option value="TOIL">TOIL</option>
        </NativeSelect>
      </>,
    );
    const select = screen.getByRole('combobox', { name: 'Balance' });
    expect(select).toHaveValue('FLEXI');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await user.selectOptions(select, 'TOIL');
    expect(select).toHaveValue('TOIL');
  });
});
