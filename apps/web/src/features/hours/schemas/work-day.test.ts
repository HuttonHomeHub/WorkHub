import { describe, expect, it } from 'vitest';

import { EMPTY_ROW, endsNextDay, parseRow, sameRow, textFromSaved, type RowText } from './work-day';

const row = (text: Partial<RowText>): RowText => ({ ...EMPTY_ROW, ...text });

describe('parseRow', () => {
  it('reads times typed as 0830, 830, 8:30 or 08.30, in London time', () => {
    for (const start of ['0830', '830', '8:30', '08.30']) {
      const parsed = parseRow('2026-10-05', row({ start, end: '17', break: '30m' }));
      expect(parsed).toEqual({
        ok: true,
        overnight: false,
        payload: {
          // 5 October is in BST: 08:30 London is 07:30 UTC.
          startsAt: '2026-10-05T07:30:00Z',
          endsAt: '2026-10-05T16:00:00Z',
          breakMinutes: 30,
          leaveMinutes: 0,
          toilTakenMinutes: 0,
          bankHolidayWorked: false,
        },
      });
    }
  });

  it('reads an end at or before the start as the next morning', () => {
    const parsed = parseRow('2026-02-04', row({ start: '22:00', end: '06:00' }));
    expect(parsed.ok && parsed.overnight).toBe(true);
    expect(parsed.ok && parsed.payload).toMatchObject({
      startsAt: '2026-02-04T22:00:00Z',
      endsAt: '2026-02-05T06:00:00Z',
    });
  });

  it('builds a night across the October clock change from the zone rules', () => {
    // Sat 24 Oct 2026 22:00 BST to Sun 25 Oct 06:00 GMT is nine hours.
    const parsed = parseRow('2026-10-24', row({ start: '2200', end: '0600' }));
    expect(parsed.ok && parsed.payload).toMatchObject({
      startsAt: '2026-10-24T21:00:00Z',
      endsAt: '2026-10-25T06:00:00Z',
    });
  });

  it('reads leave and TOIL taken as durations, and blanks as none', () => {
    const parsed = parseRow('2026-10-05', row({ leave: '7.5h', toil: '1:00' }));
    expect(parsed.ok && parsed.payload).toMatchObject({
      startsAt: null,
      endsAt: null,
      breakMinutes: 0,
      leaveMinutes: 450,
      toilTakenMinutes: 60,
    });
  });

  it('asks for the other time when only one is given', () => {
    expect(parseRow('2026-10-05', row({ start: '08:00' }))).toEqual({
      ok: false,
      errors: { end: 'Enter an end time too.' },
    });
    expect(parseRow('2026-10-05', row({ end: '17:00' }))).toEqual({
      ok: false,
      errors: { start: 'Enter a start time too.' },
    });
  });

  it('flags unreadable fields, a break without times, and a break as long as the day', () => {
    expect(parseRow('2026-10-05', row({ start: '25:00', end: '17:00' }))).toEqual({
      ok: false,
      errors: { start: 'Enter a 24-hour time, such as 08:30.' },
    });
    expect(parseRow('2026-10-05', row({ leave: 'lots' }))).toEqual({
      ok: false,
      errors: { leave: 'Enter hours and minutes, such as 0:30.' },
    });
    expect(parseRow('2026-10-05', row({ toil: '25h' }))).toEqual({
      ok: false,
      errors: { toil: 'Enter at most 24:00.' },
    });
    expect(parseRow('2026-10-05', row({ break: '0:30' }))).toEqual({
      ok: false,
      errors: { break: 'Enter a start and end time for a break.' },
    });
    expect(parseRow('2026-10-05', row({ start: '08:00', end: '09:00', break: '1h' }))).toEqual({
      ok: false,
      errors: { break: 'Enter a break shorter than the day.' },
    });
  });
});

describe('textFromSaved and sameRow', () => {
  const saved = {
    startsAt: '2026-10-05T07:00:00.000Z',
    endsAt: '2026-10-05T16:30:00.000Z',
    breakMinutes: 30,
    leaveMinutes: 0,
    toilTakenMinutes: 0,
    bankHolidayWorked: false,
  };

  it('shows a saved day as London times and h:mm, with blanks for none', () => {
    expect(textFromSaved(saved)).toEqual(
      row({ start: '08:00', end: '17:30', break: '0:30', leave: '', toil: '' }),
    );
    expect(textFromSaved(undefined)).toEqual(EMPTY_ROW);
  });

  it('treats text that reads the same as the saved row as unchanged', () => {
    const text = textFromSaved(saved);
    expect(sameRow(text, { ...text, start: '800', break: '30m' })).toBe(true);
    expect(sameRow(text, { ...text, leave: '0:00' })).toBe(true);
    expect(sameRow(text, { ...text, end: '17:45' })).toBe(false);
    expect(sameRow(text, { ...text, bankHolidayWorked: true })).toBe(false);
  });
});

describe('endsNextDay', () => {
  it('is true only for two readable times with the end at or before the start', () => {
    expect(endsNextDay({ start: '22:00', end: '06:00' })).toBe(true);
    expect(endsNextDay({ start: '08:00', end: '08:00' })).toBe(true);
    expect(endsNextDay({ start: '08:00', end: '17:00' })).toBe(false);
    expect(endsNextDay({ start: '22:00', end: '' })).toBe(false);
    expect(endsNextDay({ start: '22:00', end: '6x' })).toBe(false);
  });
});
