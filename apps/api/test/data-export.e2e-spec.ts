import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * `pnpm data:export` against a real database (docs/features/hours-tracker.md
 * → Export). Exercises `exportOwnerData`, which the CLI writes to a file.
 * Skipped when DATABASE_URL is unset (docs/TESTING.md).
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

const OWNER = randomUUID();
const OTHER = randomUUID();
const email = (id: string) => `e2e-export-${id}@example.com`;

describe.skipIf(!hasDatabase)('data export (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { PrismaClient: Client } = await import('@prisma/client');
    prisma = new Client();
    await prisma.user.createMany({
      data: [
        { id: OWNER, email: email(OWNER), name: 'Owner' },
        { id: OTHER, email: email(OTHER), name: 'Other' },
      ],
    });
    for (const ownerId of [OWNER, OTHER]) {
      await prisma.workTerm.create({
        data: { ownerId, effectiveFrom: new Date('2026-10-05T00:00:00Z') },
      });
      await prisma.workDay.create({
        data: {
          ownerId,
          date: new Date('2026-10-05T00:00:00Z'),
          startsAt: new Date('2026-10-05T07:00:00Z'),
          endsAt: new Date('2026-10-05T15:30:00Z'),
          breakMinutes: 30,
        },
      });
    }
    await prisma.workDay.create({
      data: {
        ownerId: OWNER,
        date: new Date('2026-10-06T00:00:00Z'),
        leaveMinutes: 450,
        deletedAt: new Date(),
      },
    });
    await prisma.publicHoliday.create({
      data: { ownerId: OWNER, date: new Date('2026-12-25T00:00:00Z'), name: 'Christmas Day' },
    });
    await prisma.excessConversion.create({
      data: { ownerId: OWNER, weekStart: new Date('2026-10-05T00:00:00Z') },
    });
    await prisma.timeAdjustment.create({
      data: {
        ownerId: OWNER,
        effectiveDate: new Date('2026-10-05T00:00:00Z'),
        balance: 'FLEXI',
        minutes: 90,
        reason: 'OPENING_BALANCE',
      },
    });
    await prisma.leaveYear.create({ data: { ownerId: OWNER, year: 2026, boughtLeave: true } });
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: { in: [OWNER, OTHER] } } });
    await prisma?.$disconnect();
  });

  it("exports every owned table, only the owner's rows, in the API's wire shapes", async () => {
    const { exportOwnerData, EXPORT_FORMAT } = await import('../src/cli/export');
    const data = await exportOwnerData(prisma, email(OWNER), new Date('2026-10-10T12:00:00Z'));

    expect(data).toMatchObject({
      format: EXPORT_FORMAT,
      version: 1,
      exportedAt: '2026-10-10T12:00:00.000Z',
      owner: { id: OWNER, email: email(OWNER), name: 'Owner' },
    });
    const all = Object.values(data.tables).flat() as { ownerId: string }[];
    expect(all.every((row) => row.ownerId === OWNER)).toBe(true);
    expect(data.tables.work_terms[0]).toMatchObject({
      effectiveFrom: '2026-10-05',
      bandStart: '07:00',
    });
    expect(data.tables.public_holidays).toEqual([
      expect.objectContaining({ date: '2026-12-25', name: 'Christmas Day', deletedAt: null }),
    ]);
    expect(data.tables.excess_conversions).toEqual([
      expect.objectContaining({ weekStart: '2026-10-05' }),
    ]);
    expect(data.tables.time_adjustments).toEqual([
      expect.objectContaining({ minutes: 90, balance: 'FLEXI' }),
    ]);
    expect(data.tables.leave_years).toEqual([
      expect.objectContaining({ year: 2026, boughtLeave: true }),
    ]);
  });

  it('keeps soft-deleted rows, marked with deletedAt', async () => {
    const { exportOwnerData } = await import('../src/cli/export');
    const { tables } = await exportOwnerData(prisma, email(OWNER));
    expect(tables.work_days).toHaveLength(2);
    expect(tables.work_days[0]).toMatchObject({
      date: '2026-10-05',
      startsAt: '2026-10-05T07:00:00.000Z',
      deletedAt: null,
    });
    expect(tables.work_days[1]).toMatchObject({
      date: '2026-10-06',
      deletedAt: expect.any(String),
    });
  });

  it('refuses an unknown email', async () => {
    const { exportOwnerData, ExportError } = await import('../src/cli/export');
    await expect(exportOwnerData(prisma, 'nobody@example.com')).rejects.toBeInstanceOf(ExportError);
  });
});
