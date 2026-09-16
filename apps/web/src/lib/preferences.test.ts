import { afterEach, describe, expect, it, vi } from 'vitest';

import { PREFERENCES_VERSION, preferenceKey, readPreference, writePreference } from './preferences';

const KEY = 'workhub:sidebar';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('preferences', () => {
  it('namespaces the sidebar key', () => {
    expect(preferenceKey('sidebar')).toBe(KEY);
  });

  it('returns the default when nothing is stored', () => {
    expect(readPreference('sidebar')).toEqual({ collapsed: false });
  });

  it('round-trips a written value in a versioned envelope', () => {
    writePreference('sidebar', { collapsed: true });
    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual({
      version: PREFERENCES_VERSION,
      value: { collapsed: true },
    });
    expect(readPreference('sidebar')).toEqual({ collapsed: true });
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['a bare value without the envelope', 'true'],
    ['an old version', JSON.stringify({ version: 0, value: { collapsed: true } })],
    ['a value of the wrong type', JSON.stringify({ version: 1, value: { collapsed: 'yes' } })],
    ['a missing field', JSON.stringify({ version: 1, value: {} })],
  ])('falls back to the default for %s', (_case, raw) => {
    localStorage.setItem(KEY, raw);
    expect(readPreference('sidebar')).toEqual({ collapsed: false });
  });

  it('falls back to the default when reading storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(readPreference('sidebar')).toEqual({ collapsed: false });
  });

  it('falls back to the default when localStorage itself is inaccessible', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    expect(readPreference('sidebar')).toEqual({ collapsed: false });
    expect(() => writePreference('sidebar', { collapsed: true })).not.toThrow();
  });

  it('does not throw when writing fails (quota exceeded)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    expect(() => writePreference('sidebar', { collapsed: true })).not.toThrow();
  });
});
