import { describe, expect, it } from 'vitest';

import { levelExcess } from './levelling.js';

describe('levelExcess (rule 6)', () => {
  it('levels the highest days down together', () => {
    const days = [
      { date: '2026-10-05', workedMinutes: 540, targetMinutes: 450 },
      { date: '2026-10-06', workedMinutes: 600, targetMinutes: 450 },
      { date: '2026-10-07', workedMinutes: 450, targetMinutes: 450 },
      { date: '2026-10-08', workedMinutes: 510, targetMinutes: 450 },
      { date: '2026-10-09', workedMinutes: 330, targetMinutes: 450 },
    ];
    expect(levelExcess(180, days)).toEqual({
      '2026-10-05': 50,
      '2026-10-06': 110,
      '2026-10-08': 20,
    });
  });

  it('breaks ties towards the latest date', () => {
    const days = [
      { date: '2026-10-05', workedMinutes: 500, targetMinutes: 450 },
      { date: '2026-10-06', workedMinutes: 500, targetMinutes: 450 },
    ];
    expect(levelExcess(1, days)).toEqual({ '2026-10-06': 1 });
    expect(levelExcess(3, days)).toEqual({ '2026-10-05': 1, '2026-10-06': 2 });
  });

  it('never takes more than a day worked, and skips days with no work', () => {
    const days = [
      { date: '2026-10-10', workedMinutes: 60, targetMinutes: 0 },
      { date: '2026-10-11', workedMinutes: 0, targetMinutes: 0 },
    ];
    expect(levelExcess(60, days)).toEqual({ '2026-10-10': 60 });
    expect(() => levelExcess(61, days)).toThrow(RangeError);
  });

  it('allocates nothing for no excess', () => {
    expect(
      levelExcess(0, [{ date: '2026-10-05', workedMinutes: 500, targetMinutes: 450 }]),
    ).toEqual({});
  });
});
