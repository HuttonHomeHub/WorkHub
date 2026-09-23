import { describe, expect, it } from 'vitest';

import {
  decimalHours,
  formatDuration,
  formatFlexi,
  formatSignedDuration,
  formatTimeOfDay,
  parseDuration,
  parseTimeOfDay,
} from './format.js';

describe('parseTimeOfDay', () => {
  it.each([
    ['0830', 510],
    ['830', 510],
    ['8:30', 510],
    ['08.30', 510],
    ['7', 420],
    [' 17:05 ', 1025],
    ['0', 0],
    ['23:59', 1439],
  ])('reads %s as %i minutes', (text, minutes) => {
    expect(parseTimeOfDay(text)).toBe(minutes);
  });

  it.each(['24:00', '25:00', '8:60', '-1', '', 'abc', '12345', '8:5'])('rejects %j', (text) => {
    expect(parseTimeOfDay(text)).toBeNull();
  });

  it('formats a time of day zero-padded', () => {
    expect(formatTimeOfDay(510)).toBe('08:30');
    expect(formatTimeOfDay(0)).toBe('00:00');
  });
});

describe('parseDuration', () => {
  it.each([
    ['0:30', 30],
    ['7:30', 450],
    ['30m', 30],
    ['7.5h', 450],
    ['7h', 420],
    ['7.5', 450],
    ['.5', 30],
    ['40:30', 2430],
  ])('reads %s as %i minutes', (text, minutes) => {
    expect(parseDuration(text)).toBe(minutes);
  });

  it.each(['', '-0:30', '1:75', 'abc', '-2h'])('rejects %j', (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});

describe('formatting durations (rule 14)', () => {
  it('uses h:mm, including totals over 24 hours', () => {
    expect(formatDuration(450)).toBe('7:30');
    expect(formatDuration(2430)).toBe('40:30');
    expect(formatDuration(1500)).toBe('25:00');
    expect(formatDuration(5)).toBe('0:05');
  });

  it('uses a true minus sign for negatives', () => {
    expect(formatDuration(-120)).toBe('−2:00');
    expect(formatSignedDuration(40)).toBe('+0:40');
    expect(formatSignedDuration(0)).toBe('0:00');
  });

  it('shows flexi direction in words', () => {
    expect(formatFlexi(40)).toBe('+0:40 over');
    expect(formatFlexi(-120)).toBe('−2:00 under');
    expect(formatFlexi(0)).toBe('0:00');
  });

  it('gives decimal hours for CSV', () => {
    expect(decimalHours(450)).toBe(7.5);
    expect(decimalHours(-130)).toBe(-2.17);
    expect(decimalHours(0)).toBe(0);
  });
});
