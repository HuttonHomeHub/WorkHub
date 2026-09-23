import type {
  ExcessConversion,
  LeaveYear,
  PrismaClient,
  PublicHoliday,
  TimeAdjustment,
  WorkDay,
  WorkTerm,
} from '@prisma/client';

import { PublicHolidayResponseDto } from '../modules/core/public-holidays/dto/public-holiday-response.dto';
import { ExcessConversionResponseDto } from '../modules/hours/excess-conversions/dto/excess-conversion-response.dto';
import { LeaveYearResponseDto } from '../modules/hours/leave-years/dto/leave-year-response.dto';
import { TimeAdjustmentResponseDto } from '../modules/hours/time-adjustments/dto/time-adjustment-response.dto';
import { WorkDayResponseDto } from '../modules/hours/work-days/dto/work-day-response.dto';
import { WorkTermResponseDto } from '../modules/hours/work-terms/dto/work-term-response.dto';

/** The export's format marker and version, so a reader can check it. */
export const EXPORT_FORMAT = 'workhub-export';
export const EXPORT_VERSION = 1;

type Row = { deletedAt: Date | null };
type Serialised = Record<string, unknown>;

/** Every row as the API sends it, plus `deletedAt` (the export keeps the trash too). */
const withDeletedAt =
  <T extends Row>(toDto: (row: T) => object) =>
  (row: T): Serialised => ({ ...toDto(row), deletedAt: row.deletedAt?.toISOString() ?? null });

/**
 * Every owned domain table, by table name, with how to read and serialise it
 * (docs/DATABASE.md → Data export). `export.spec.ts` fails if a Prisma model
 * with an `ownerId` is missing here, so a new table cannot be left out.
 */
export const EXPORTED_TABLES = {
  public_holidays: {
    model: 'PublicHoliday',
    read: (db: PrismaClient, ownerId: string) =>
      db.publicHoliday.findMany({ where: { ownerId }, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
    serialise: withDeletedAt((row: PublicHoliday) => PublicHolidayResponseDto.from(row)),
  },
  work_terms: {
    model: 'WorkTerm',
    read: (db: PrismaClient, ownerId: string) =>
      db.workTerm.findMany({
        where: { ownerId },
        orderBy: [{ effectiveFrom: 'asc' }, { id: 'asc' }],
      }),
    serialise: withDeletedAt((row: WorkTerm) => WorkTermResponseDto.from(row)),
  },
  leave_years: {
    model: 'LeaveYear',
    read: (db: PrismaClient, ownerId: string) =>
      db.leaveYear.findMany({ where: { ownerId }, orderBy: [{ year: 'asc' }, { id: 'asc' }] }),
    serialise: withDeletedAt((row: LeaveYear) => LeaveYearResponseDto.from(row)),
  },
  time_adjustments: {
    model: 'TimeAdjustment',
    read: (db: PrismaClient, ownerId: string) =>
      db.timeAdjustment.findMany({
        where: { ownerId },
        orderBy: [{ effectiveDate: 'asc' }, { id: 'asc' }],
      }),
    serialise: withDeletedAt((row: TimeAdjustment) => TimeAdjustmentResponseDto.from(row)),
  },
  work_days: {
    model: 'WorkDay',
    read: (db: PrismaClient, ownerId: string) =>
      db.workDay.findMany({ where: { ownerId }, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
    serialise: withDeletedAt((row: WorkDay) => WorkDayResponseDto.from(row)),
  },
  excess_conversions: {
    model: 'ExcessConversion',
    read: (db: PrismaClient, ownerId: string) =>
      db.excessConversion.findMany({
        where: { ownerId },
        orderBy: [{ weekStart: 'asc' }, { id: 'asc' }],
      }),
    serialise: withDeletedAt((row: ExcessConversion) => ExcessConversionResponseDto.from(row)),
  },
} as const;

export type ExportedTable = keyof typeof EXPORTED_TABLES;

export interface OwnerExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  owner: { id: string; email: string; name: string };
  tables: Record<ExportedTable, Serialised[]>;
}

export class ExportError extends Error {}

/**
 * Everything one owner owns, as JSON-ready data. Soft-deleted rows are
 * included (with `deletedAt`), so the export is a faithful copy of the
 * owner's data, not only what the app shows. Reads run in one transaction for
 * a consistent snapshot.
 */
export async function exportOwnerData(
  db: PrismaClient,
  email: string,
  now: Date = new Date(),
): Promise<OwnerExport> {
  const owner = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true },
  });
  if (!owner) throw new ExportError(`No account with the email ${email}.`);

  const entries = Object.entries(EXPORTED_TABLES) as [
    ExportedTable,
    (typeof EXPORTED_TABLES)[ExportedTable],
  ][];
  const tables = await db.$transaction(
    async (tx) => {
      const out = {} as Record<ExportedTable, Serialised[]>;
      for (const [name, table] of entries) {
        const rows = (await table.read(tx as PrismaClient, owner.id)) as Row[];
        out[name] = rows.map((row) => (table.serialise as (r: Row) => Serialised)(row));
      }
      return out;
    },
    { isolationLevel: 'RepeatableRead' },
  );

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    owner,
    tables,
  };
}
