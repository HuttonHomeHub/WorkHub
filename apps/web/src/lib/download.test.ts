import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadText, REVOKE_AFTER_MS } from './download';

// jsdom has no object URLs; each test puts stand-ins in place and this restores them.
const { createObjectURL, revokeObjectURL } = URL;

afterEach(() => {
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('downloadText', () => {
  it('clicks a temporary link to the file and revokes its URL only after a delay', () => {
    vi.useFakeTimers();
    const create = vi.fn(() => 'blob:hours');
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push(this.download);
    });

    downloadText('hours-2026-10-05.csv', 'a,b\r\n');

    expect(clicked).toEqual(['hours-2026-10-05.csv']);
    expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(REVOKE_AFTER_MS - 1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledWith('blob:hours');
  });
});
