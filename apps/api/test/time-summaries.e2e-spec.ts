import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthContextService } from '../src/common/auth/auth-context.service';
import { Principal } from '../src/common/auth/principal';
import type { PrismaService } from '../src/prisma/prisma.service';

/**
 * End-to-end HTTP tests for the work days API. Boots the real Nest app
 * (global pipe, filter, interceptor, guards) against a real PostgreSQL, and
 * overrides the authentication seam to inject a test principal (the standard
 * NestJS pattern — production auth stays deny-by-default). The real session
 * flow is covered separately by `test/auth.e2e-spec.ts`.
 *
 * Requires a database: run in CI (Postgres service + migrations). Skipped
 * locally when DATABASE_URL is unset. `AppModule` is imported lazily so a
 * skipped run never triggers configuration validation. See docs/TESTING.md.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

// Fresh users per suite: e2e files run in parallel against one database, and
// each suite's cleanup deletes its users (cascading to their rows), so shared
// ids would let one suite delete another's data mid-test.
const USER = randomUUID();
const OTHER_USER = randomUUID();

describe.skipIf(!hasDatabase)('Time summaries and balances API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  // Mutable so individual tests can act as a different user (IDOR checks).
  let principal = new Principal(USER, 'owner@example.com', 'Test User');
  const base = '/api/v1/time-summaries';

  beforeAll(async () => {
    process.env.LOG_LEVEL ??= 'silent';
    const { AppModule } = await import('../src/app.module');
    const { configureApp } = await import('../src/app.setup');
    const { PrismaService: PrismaServiceToken } = await import('../src/prisma/prisma.service');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthContextService)
      .useValue({ resolve: () => Promise.resolve(principal) })
      .compile();

    app = moduleRef.createNestApplication({ bufferLogs: false, bodyParser: false });
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaServiceToken);
    // owner_id is a foreign key to users.id, so the test principals must exist.
    await prisma.user.createMany({
      data: [
        { id: USER, email: `e2e-owner-${USER}@example.com`, name: 'Owner' },
        { id: OTHER_USER, email: `e2e-other-${OTHER_USER}@example.com`, name: 'Other' },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { id: { in: [USER, OTHER_USER] } } });
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const as = (who: string) => {
    principal = new Principal(who, `${who}@example.com`, 'Someone');
  };
  const post = (path: string, body: Record<string, unknown>) =>
    request(server()).post(`/api/v1/${path}`).send(body).expect(201);
  /** A day with London wall-clock times on a date in BST (UTC+1). */
  const bstDay = (date: string, start: string, end: string, breakMinutes = 30) => {
    const utc = (t: string) => `${String(Number(t.slice(0, 2)) - 1).padStart(2, '0')}${t.slice(2)}`;
    return post('work-days', {
      date,
      startsAt: `${date}T${utc(start)}:00.000Z`,
      endsAt: `${date}T${utc(end)}:00.000Z`,
      breakMinutes,
    });
  };
  const summaries = (query: Record<string, string>) => request(server()).get(base).query(query);
  const balances = (asOf: string) => request(server()).get('/api/v1/time-balances').query({ asOf });

  beforeEach(async () => {
    const owners = { ownerId: { in: [USER, OTHER_USER] } };
    await prisma.workDay.deleteMany({ where: owners });
    await prisma.excessConversion.deleteMany({ where: owners });
    await prisma.timeAdjustment.deleteMany({ where: owners });
    await prisma.workTerm.deleteMany({ where: owners });
    as(USER);
  });

  it('rejects a reversed range, a range over 366 days and a missing asOf with 422', async () => {
    await post('work-terms', { effectiveFrom: '2026-09-28' });
    await summaries({ from: '2026-10-05', to: '2026-10-05', asOf: '2026-10-10' }).expect(422);
    await summaries({ from: '2026-01-01', to: '2027-01-03', asOf: '2026-10-10' }).expect(422);
    await summaries({ from: '2026-10-05', to: '2026-10-12' }).expect(422);
    await summaries({
      from: '2026-10-05',
      to: '2026-10-12',
      asOf: '2026-10-10',
      groupBy: 'year',
    }).expect(422);
    await summaries({ from: '2026-01-01', to: '2027-01-02', asOf: '2026-10-10' }).expect(200);
  });

  it('returns nothing to count before any terms exist', async () => {
    const res = await summaries({
      from: '2026-10-05',
      to: '2026-10-12',
      asOf: '2026-10-10',
    }).expect(200);
    expect(res.body.data).toEqual([]);
    expect((await balances('2026-10-10').expect(200)).body.data).toMatchObject({
      trackingStart: null,
      flexiMinutes: 0,
    });
  });

  describe('the cross-month worked example (week of 28 September 2026)', () => {
    beforeEach(async () => {
      await post('work-terms', { effectiveFrom: '2026-09-28' });
      await bstDay('2026-09-28', '08:00', '18:00'); // 9:30
      await bstDay('2026-09-29', '08:00', '16:00');
      await bstDay('2026-09-30', '08:00', '16:00');
      await bstDay('2026-10-01', '08:00', '17:00'); // 8:30
      await bstDay('2026-10-02', '08:00', '16:00');
      await post('excess-conversions', { weekStart: '2026-09-28' });
    });

    it('is a preview before settlement (asOf Thursday 1 October)', async () => {
      const res = await summaries({
        from: '2026-09-28',
        to: '2026-10-05',
        asOf: '2026-10-01',
      }).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        key: '2026-09-28',
        start: '2026-09-28',
        end: '2026-10-05',
        conversion: 'PREVIEW',
        settlementDate: '2026-10-02',
        excessMinutes: 180,
        convertedMinutes: 0,
        // Preview: October's 1:00 stays TOIL; September's 2:00 previews as overtime.
        conversionToilMinutes: 60,
        conversionOvertimeUnpaidMinutes: 120,
      });
    });

    it('applies from settlement, by allocation date and month (asOf Friday 2 October)', async () => {
      const weeks = await summaries({
        from: '2026-09-28',
        to: '2026-10-05',
        asOf: '2026-10-02',
      }).expect(200);
      expect(weeks.body.data[0]).toMatchObject({
        conversion: 'APPLIED',
        convertedMinutes: 180,
        flexiMinutes: 0,
      });

      const months = await summaries({
        from: '2026-09-01',
        to: '2026-11-01',
        groupBy: 'month',
        asOf: '2026-10-02',
      }).expect(200);
      expect(months.body.data.map((m: { key: string }) => m.key)).toEqual(['2026-09', '2026-10']);
      const [september, october] = months.body.data as Record<string, unknown>[];
      // September's 2:00 TOIL is unused at its end, so it is unpaid overtime on 30 Sep.
      expect(september).toMatchObject({
        toilMinutes: 120,
        toilUnusedMinutes: 120,
        overtimeUnpaidMinutes: 120,
      });
      expect(october).toMatchObject({ toilMinutes: 60, overtimeUnpaidMinutes: 0 });

      const bal = await balances('2026-10-02').expect(200);
      expect(bal.body.data).toMatchObject({
        trackingStart: '2026-09-28',
        flexiMinutes: 0,
        toilMonthMinutes: 60,
        toilCapMinutes: 450,
        overtimeUnpaidYearMinutes: 120,
        overtimePaidYearMinutes: 0,
      });
    });

    it('widens a partial range to whole weeks', async () => {
      const res = await summaries({
        from: '2026-09-30',
        to: '2026-10-01',
        asOf: '2026-10-02',
      }).expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        start: '2026-09-28',
        end: '2026-10-05',
        workedMinutes: 2430,
      });
    });

    it("never counts another owner's rows", async () => {
      as(OTHER_USER);
      await post('work-terms', { effectiveFrom: '2026-09-28' });
      await bstDay('2026-09-28', '06:00', '20:00');
      const theirs = await summaries({
        from: '2026-09-28',
        to: '2026-10-05',
        asOf: '2026-10-02',
      }).expect(200);
      expect(theirs.body.data[0]).toMatchObject({ conversion: 'OFF', workedMinutes: 810 });

      as(USER);
      const mine = await summaries({
        from: '2026-09-28',
        to: '2026-10-05',
        asOf: '2026-10-02',
      }).expect(200);
      expect(mine.body.data[0]).toMatchObject({ workedMinutes: 2430, excessMinutes: 180 });
    });
  });

  it('caps TOIL at 7:30 a month and makes paid overtime follow the terms on its date', async () => {
    await post('work-terms', { effectiveFrom: '2026-10-05' });
    await post('work-terms', { effectiveFrom: '2026-10-12', paidOvertimeAllowed: true });
    await post('time-adjustments', {
      effectiveDate: '2026-10-05',
      balance: 'TOIL',
      minutes: 390,
      reason: 'OPENING_BALANCE',
    });
    // Week of 5 Oct: Monday +2:00 → 1:00 TOIL fills the cap, 1:00 unpaid overtime.
    await bstDay('2026-10-05', '08:00', '18:00');
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
      await bstDay(d, '08:00', '16:00');
    await post('excess-conversions', { weekStart: '2026-10-05' });
    // Week of 12 Oct (paid overtime allowed): Monday +1:00 → all overtime, paid.
    await bstDay('2026-10-12', '08:00', '17:00');
    for (const d of ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])
      await bstDay(d, '08:00', '16:00');
    await post('excess-conversions', { weekStart: '2026-10-12' });

    const weeks = await summaries({
      from: '2026-10-05',
      to: '2026-10-19',
      asOf: '2026-10-17',
    }).expect(200);
    expect(weeks.body.data).toMatchObject([
      { key: '2026-10-05', toilMinutes: 60, overtimeUnpaidMinutes: 60, overtimePaidMinutes: 0 },
      { key: '2026-10-12', toilMinutes: 0, overtimeUnpaidMinutes: 0, overtimePaidMinutes: 60 },
    ]);
  });

  it('converts whole blocks and leaves the rest of the excess as flexi', async () => {
    await post('work-terms', { effectiveFrom: '2026-10-05' });
    // The worked example with Friday 5:15 (E = 2:45): five 0:30 blocks
    // convert (Tue 1:30, Mon 0:30, Thu 0:30) and 0:15 stays as flexi.
    await bstDay('2026-10-05', '08:00', '17:30');
    await bstDay('2026-10-06', '07:30', '18:00');
    await bstDay('2026-10-07', '08:00', '16:00');
    await bstDay('2026-10-08', '08:00', '17:00');
    await bstDay('2026-10-09', '08:00', '13:15', 0);
    await post('excess-conversions', { weekStart: '2026-10-05' });

    const days = await summaries({
      from: '2026-10-05',
      to: '2026-10-12',
      groupBy: 'day',
      asOf: '2026-10-10',
    }).expect(200);
    const converted = (days.body.data as { key: string; convertedMinutes: number }[]).map(
      (group) => [group.key, group.convertedMinutes],
    );
    expect(converted.slice(0, 5)).toEqual([
      ['2026-10-05', 30],
      ['2026-10-06', 90],
      ['2026-10-07', 0],
      ['2026-10-08', 30],
      ['2026-10-09', 0],
    ]);
    const week = await summaries({
      from: '2026-10-05',
      to: '2026-10-12',
      asOf: '2026-10-10',
    }).expect(200);
    expect(week.body.data[0]).toMatchObject({
      conversion: 'APPLIED',
      excessMinutes: 165,
      conversionBlockMinutes: 30,
      conversionMinutes: 150,
      convertedMinutes: 150,
      flexiMinutes: 15,
      conversionToilMinutes: 150,
      flexiBalanceEndMinutes: 15,
    });
    expect((await balances('2026-10-10').expect(200)).body.data.flexiMinutes).toBe(15);
  });

  it('follows the conversion block in the week’s terms (1:00)', async () => {
    await post('work-terms', { effectiveFrom: '2026-10-05', conversionBlockMinutes: 60 });
    // Monday +1:45: one 1:00 block converts; 0:45 stays as flexi.
    await bstDay('2026-10-05', '08:00', '17:45', 0);
    for (const d of ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
      await bstDay(d, '08:00', '16:00');
    await post('excess-conversions', { weekStart: '2026-10-05' });
    const week = await summaries({
      from: '2026-10-05',
      to: '2026-10-12',
      asOf: '2026-10-10',
    }).expect(200);
    expect(week.body.data[0]).toMatchObject({
      excessMinutes: 105,
      conversionBlockMinutes: 60,
      conversionMinutes: 60,
      convertedMinutes: 60,
      flexiMinutes: 45,
    });
  });

  it('answers at the edges of the 2000–2100 window, never a 500 (security review)', async () => {
    await post('work-terms', { effectiveFrom: '2100-11-29' });
    // Widening the last partial week of 2100 would end in 2101.
    await summaries({ from: '2100-12-01', to: '2100-12-31', asOf: '2100-12-31' }).expect(200);
    await summaries({
      from: '2100-12-01',
      to: '2100-12-31',
      groupBy: 'week',
      asOf: '2100-12-31',
    }).expect(200);
    await balances('2100-12-31').expect(200);
    await summaries({ from: '2000-01-01', to: '2000-01-08', asOf: '2000-01-05' }).expect(200);
  });
});
