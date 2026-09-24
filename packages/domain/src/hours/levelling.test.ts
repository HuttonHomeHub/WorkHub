import { describe, expect, it } from 'vitest';

import { levelExcess } from './levelling.js';

// The feature doc's worked example: surpluses Mon 1:30, Tue 2:30, Wed 0:00,
// Thu 1:00, Fri −2:00.
const exampleDays = [
  { date: '2026-10-05', workedMinutes: 540, targetMinutes: 450 },
  { date: '2026-10-06', workedMinutes: 600, targetMinutes: 450 },
  { date: '2026-10-07', workedMinutes: 450, targetMinutes: 450 },
  { date: '2026-10-08', workedMinutes: 510, targetMinutes: 450 },
  { date: '2026-10-09', workedMinutes: 330, targetMinutes: 450 },
];

const total = (allocation: Record<string, number>) =>
  Object.values(allocation).reduce((sum, minutes) => sum + minutes, 0);

describe('levelExcess (rule 6, whole blocks)', () => {
  it('takes 0:30 blocks from the highest day, latest first on a tie', () => {
    // Tue, Tue, Tue (tie with Mon at 1:30), Mon, Thu (tie at 1:00), Tue.
    expect(levelExcess(180, exampleDays, 30)).toEqual({
      '2026-10-05': 30,
      '2026-10-06': 120,
      '2026-10-08': 30,
    });
  });

  it('with a one-minute block, levels minute by minute to a common line', () => {
    expect(levelExcess(180, exampleDays, 1)).toEqual({
      '2026-10-05': 50,
      '2026-10-06': 110,
      '2026-10-08': 20,
    });
  });

  it('converts whole blocks only and leaves the remainder', () => {
    // E = 2:45: five blocks (2:30); 0:15 stays as flexi.
    const allocation = levelExcess(165, exampleDays, 30);
    expect(total(allocation)).toBe(150);
    expect(allocation).toEqual({ '2026-10-05': 30, '2026-10-06': 90, '2026-10-08': 30 });
  });

  it('uses the block it is given: 0:15 and 1:00', () => {
    // 0:15: Tue ×4 to 1:30, then Tue and Mon in turn to 1:00, then Thu, Tue
    // and Mon to 0:45, then Thu → Mon 0:45, Tue 1:45, Thu 0:30 (3:00).
    const quarter = levelExcess(180, exampleDays, 15);
    expect(quarter).toEqual({ '2026-10-05': 45, '2026-10-06': 105, '2026-10-08': 30 });
    // 1:00: Tue (2:30 → 1:30), Tue (tie with Mon, latest), Mon → 3:00.
    const hour = levelExcess(180, exampleDays, 60);
    expect(hour).toEqual({ '2026-10-05': 60, '2026-10-06': 120 });
  });

  it('converts nothing when E is less than one block', () => {
    expect(levelExcess(29, exampleDays, 30)).toEqual({});
    expect(levelExcess(59, exampleDays, 60)).toEqual({});
  });

  it('gives every day a multiple of the block', () => {
    for (const block of [1, 7, 15, 30, 45, 60, 90]) {
      for (let excess = 0; excess <= 180; excess += 11) {
        const allocation = levelExcess(excess, exampleDays, block);
        for (const minutes of Object.values(allocation)) expect(minutes % block).toBe(0);
        expect(total(allocation)).toBe(Math.floor(excess / block) * block);
      }
    }
  });

  it('breaks ties towards the latest date', () => {
    const days = [
      { date: '2026-10-05', workedMinutes: 500, targetMinutes: 450 },
      { date: '2026-10-06', workedMinutes: 500, targetMinutes: 450 },
    ];
    expect(levelExcess(30, days, 30)).toEqual({ '2026-10-06': 30 });
    expect(levelExcess(90, days, 30)).toEqual({ '2026-10-05': 30, '2026-10-06': 60 });
  });

  it('may take a day below its target when that is where the level falls', () => {
    // Surpluses 0:10 and 0:05: the first block takes Tue to −0:20, the second
    // Mon to −0:25.
    const days = [
      { date: '2026-10-05', workedMinutes: 455, targetMinutes: 450 },
      { date: '2026-10-06', workedMinutes: 460, targetMinutes: 450 },
    ];
    expect(levelExcess(60, days, 30)).toEqual({ '2026-10-05': 30, '2026-10-06': 30 });
  });

  it('takes a block only from a day with a whole block of worked time left', () => {
    const days = [
      { date: '2026-10-10', workedMinutes: 60, targetMinutes: 0 },
      { date: '2026-10-11', workedMinutes: 20, targetMinutes: 0 },
      { date: '2026-10-12', workedMinutes: 0, targetMinutes: 0 },
    ];
    expect(levelExcess(60, days, 30)).toEqual({ '2026-10-10': 60 });
    // Three blocks: Sat gives its 1:00; Sun's 0:20 is under a block, so
    // allocation stops at two.
    expect(levelExcess(90, days, 30)).toEqual({ '2026-10-10': 60 });
    expect(levelExcess(80, days, 1)).toEqual({ '2026-10-10': 60, '2026-10-11': 20 });
  });

  it('allocates nothing for no excess', () => {
    expect(levelExcess(0, exampleDays, 30)).toEqual({});
  });

  it('refuses a block that is not a whole number of minutes', () => {
    expect(() => levelExcess(60, exampleDays, 0)).toThrow(RangeError);
    expect(() => levelExcess(60, exampleDays, 1.5)).toThrow(RangeError);
  });
});
