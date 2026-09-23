import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { DurationInput } from './duration-input';
import { TimeInput } from './time-input';

function Harness({ kind, signed = false }: { kind: 'time' | 'duration'; signed?: boolean }) {
  const [value, setValue] = React.useState('');
  return (
    <>
      <label htmlFor="field">Field</label>
      {kind === 'time' ? (
        <TimeInput id="field" value={value} onValueChange={setValue} />
      ) : (
        <DurationInput id="field" value={value} onValueChange={setValue} signed={signed} />
      )}
      <button type="button">Next</button>
    </>
  );
}

async function typeAndBlur(text: string) {
  const user = userEvent.setup();
  const field = screen.getByLabelText('Field');
  await user.clear(field);
  await user.type(field, text);
  await user.tab();
  return field;
}

describe('TimeInput', () => {
  it('describes its format with a linked 24-hour hint', () => {
    render(<Harness kind="time" />);
    expect(screen.getByLabelText('Field')).toHaveAccessibleDescription('24-hour, e.g. 08:30');
  });

  it('keeps a description the form links, before its own hint', () => {
    render(
      <>
        <p id="form-error">Enter a 24-hour time, such as 08:30.</p>
        <TimeInput
          aria-label="Starts"
          aria-describedby="form-error"
          value=""
          onValueChange={() => {}}
        />
      </>,
    );
    expect(screen.getByLabelText('Starts')).toHaveAccessibleDescription(
      'Enter a 24-hour time, such as 08:30. 24-hour, e.g. 08:30',
    );
  });

  it.each([
    ['0830', '08:30'],
    ['830', '08:30'],
    ['8:30', '08:30'],
    ['08.30', '08:30'],
    ['7', '07:00'],
    ['1905', '19:05'],
  ])('reads %s as %s on blur', async (typed, shown) => {
    render(<Harness kind="time" />);
    expect(await typeAndBlur(typed)).toHaveValue(shown);
  });

  it('leaves something it cannot read as typed, for the form to flag', async () => {
    render(<Harness kind="time" />);
    expect(await typeAndBlur('25:00')).toHaveValue('25:00');
  });

  it('does not reformat while typing', async () => {
    const user = userEvent.setup();
    render(<Harness kind="time" />);
    await user.type(screen.getByLabelText('Field'), '083');
    expect(screen.getByLabelText('Field')).toHaveValue('083');
  });
});

describe('DurationInput', () => {
  it('describes its format with a linked hint', () => {
    render(<Harness kind="duration" />);
    expect(screen.getByLabelText('Field')).toHaveAccessibleDescription(
      'Hours and minutes, e.g. 7:30, 30m or 7.5h',
    );
  });

  it.each([
    ['0:30', '0:30'],
    ['30m', '0:30'],
    ['7.5h', '7:30'],
    ['7.5', '7:30'],
    ['37:30', '37:30'],
    ['90m', '1:30'],
  ])('reads %s as %s on blur', async (typed, shown) => {
    render(<Harness kind="duration" />);
    expect(await typeAndBlur(typed)).toHaveValue(shown);
  });

  it('leaves an empty field empty, meaning "not set"', async () => {
    const user = userEvent.setup();
    render(<Harness kind="duration" />);
    await user.click(screen.getByLabelText('Field'));
    await user.tab();
    expect(screen.getByLabelText('Field')).toHaveValue('');
  });

  it('leaves something it cannot read as typed', async () => {
    render(<Harness kind="duration" />);
    expect(await typeAndBlur('7:75')).toHaveValue('7:75');
  });

  it('accepts a minus sign when signed, and shows a true minus', async () => {
    render(<Harness kind="duration" signed />);
    expect(await typeAndBlur('-2h')).toHaveValue('−2:00');
    expect(screen.getByLabelText('Field')).toHaveAccessibleDescription(/a minus subtracts/);
  });

  it('does not accept a sign when unsigned', async () => {
    render(<Harness kind="duration" />);
    expect(await typeAndBlur('-2h')).toHaveValue('-2h');
  });
});
