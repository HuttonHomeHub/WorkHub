-- CreateEnum
CREATE TYPE "TimeAdjustmentBalance" AS ENUM ('FLEXI', 'TOIL', 'LEAVE');

-- CreateEnum
CREATE TYPE "TimeAdjustmentReason" AS ENUM ('OPENING_BALANCE', 'FORFEIT', 'CORRECTION');

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_terms" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "target_minutes_mon" INTEGER DEFAULT 450,
    "target_minutes_tue" INTEGER DEFAULT 450,
    "target_minutes_wed" INTEGER DEFAULT 450,
    "target_minutes_thu" INTEGER DEFAULT 450,
    "target_minutes_fri" INTEGER DEFAULT 450,
    "target_minutes_sat" INTEGER,
    "target_minutes_sun" INTEGER,
    "min_minutes_mon" INTEGER DEFAULT 450,
    "min_minutes_tue" INTEGER DEFAULT 450,
    "min_minutes_wed" INTEGER DEFAULT 450,
    "min_minutes_thu" INTEGER DEFAULT 450,
    "min_minutes_fri" INTEGER DEFAULT 330,
    "min_minutes_sat" INTEGER,
    "min_minutes_sun" INTEGER,
    "break_threshold_minutes" INTEGER NOT NULL DEFAULT 360,
    "break_minimum_minutes" INTEGER NOT NULL DEFAULT 30,
    "band_start" TIME(0) NOT NULL DEFAULT '07:00:00'::time,
    "band_end" TIME(0) NOT NULL DEFAULT '19:00:00'::time,
    "paid_overtime_allowed" BOOLEAN NOT NULL DEFAULT false,
    "toil_monthly_cap_minutes" INTEGER NOT NULL DEFAULT 450,
    "leave_day_max_minutes" INTEGER NOT NULL DEFAULT 450,
    "flexi_credit_cap_minutes" INTEGER,
    "flexi_debit_cap_minutes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "work_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_years" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "allowance_minutes" INTEGER NOT NULL DEFAULT 14850,
    "bought_leave" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "leave_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_adjustments" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "effective_date" DATE NOT NULL,
    "balance" "TimeAdjustmentBalance" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" "TimeAdjustmentReason" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "time_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_adjustments_owner_id_effective_date_idx" ON "time_adjustments"("owner_id", "effective_date");

-- AddForeignKey
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_terms" ADD CONSTRAINT "work_terms_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_years" ADD CONSTRAINT "leave_years_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_adjustments" ADD CONSTRAINT "time_adjustments_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: CHECK constraints and partial unique indexes (Prisma 6 cannot
-- declare them; each is listed in a comment on its model in schema.prisma).
-- All tables are new and empty, so nothing here touches existing data.
-- ---------------------------------------------------------------------------

-- public_holidays
ALTER TABLE "public_holidays"
  ADD CONSTRAINT "ck_public_holidays_name_length"
    CHECK (char_length(btrim("name")) >= 1 AND char_length("name") <= 100);

-- One active holiday per date; also serves the owner-scoped date-range list.
CREATE UNIQUE INDEX "uq_public_holidays_owner_id_date_active"
  ON "public_holidays" ("owner_id", "date") WHERE "deleted_at" IS NULL;

-- work_terms
ALTER TABLE "work_terms"
  ADD CONSTRAINT "ck_work_terms_effective_from_monday"
    CHECK (EXTRACT(ISODOW FROM "effective_from") = 1),
  ADD CONSTRAINT "ck_work_terms_target_minutes_range"
    CHECK (
          ("target_minutes_mon" IS NULL OR "target_minutes_mon" BETWEEN 0 AND 1440)
      AND ("target_minutes_tue" IS NULL OR "target_minutes_tue" BETWEEN 0 AND 1440)
      AND ("target_minutes_wed" IS NULL OR "target_minutes_wed" BETWEEN 0 AND 1440)
      AND ("target_minutes_thu" IS NULL OR "target_minutes_thu" BETWEEN 0 AND 1440)
      AND ("target_minutes_fri" IS NULL OR "target_minutes_fri" BETWEEN 0 AND 1440)
      AND ("target_minutes_sat" IS NULL OR "target_minutes_sat" BETWEEN 0 AND 1440)
      AND ("target_minutes_sun" IS NULL OR "target_minutes_sun" BETWEEN 0 AND 1440)
    ),
  ADD CONSTRAINT "ck_work_terms_min_minutes_range"
    CHECK (
          ("min_minutes_mon" IS NULL OR "min_minutes_mon" BETWEEN 0 AND 1440)
      AND ("min_minutes_tue" IS NULL OR "min_minutes_tue" BETWEEN 0 AND 1440)
      AND ("min_minutes_wed" IS NULL OR "min_minutes_wed" BETWEEN 0 AND 1440)
      AND ("min_minutes_thu" IS NULL OR "min_minutes_thu" BETWEEN 0 AND 1440)
      AND ("min_minutes_fri" IS NULL OR "min_minutes_fri" BETWEEN 0 AND 1440)
      AND ("min_minutes_sat" IS NULL OR "min_minutes_sat" BETWEEN 0 AND 1440)
      AND ("min_minutes_sun" IS NULL OR "min_minutes_sun" BETWEEN 0 AND 1440)
    ),
  ADD CONSTRAINT "ck_work_terms_min_requires_target"
    CHECK (
          ("min_minutes_mon" IS NULL OR "target_minutes_mon" IS NOT NULL)
      AND ("min_minutes_tue" IS NULL OR "target_minutes_tue" IS NOT NULL)
      AND ("min_minutes_wed" IS NULL OR "target_minutes_wed" IS NOT NULL)
      AND ("min_minutes_thu" IS NULL OR "target_minutes_thu" IS NOT NULL)
      AND ("min_minutes_fri" IS NULL OR "target_minutes_fri" IS NOT NULL)
      AND ("min_minutes_sat" IS NULL OR "target_minutes_sat" IS NOT NULL)
      AND ("min_minutes_sun" IS NULL OR "target_minutes_sun" IS NOT NULL)
    ),
  ADD CONSTRAINT "ck_work_terms_break_threshold_range"
    CHECK ("break_threshold_minutes" BETWEEN 0 AND 1440),
  ADD CONSTRAINT "ck_work_terms_break_minimum_range"
    CHECK ("break_minimum_minutes" BETWEEN 0 AND 1440),
  ADD CONSTRAINT "ck_work_terms_leave_day_max_range"
    CHECK ("leave_day_max_minutes" BETWEEN 0 AND 1440),
  ADD CONSTRAINT "ck_work_terms_band_order"
    CHECK ("band_end" > "band_start"),
  ADD CONSTRAINT "ck_work_terms_toil_monthly_cap_range"
    CHECK ("toil_monthly_cap_minutes" BETWEEN 0 AND 10080),
  ADD CONSTRAINT "ck_work_terms_flexi_credit_cap_range"
    CHECK ("flexi_credit_cap_minutes" IS NULL OR "flexi_credit_cap_minutes" BETWEEN 0 AND 10080),
  ADD CONSTRAINT "ck_work_terms_flexi_debit_cap_range"
    CHECK ("flexi_debit_cap_minutes" IS NULL OR "flexi_debit_cap_minutes" BETWEEN 0 AND 10080);

-- One active set of terms per Monday; also serves the list and the
-- "terms in force on a date" lookup (owner_id = ? AND effective_from <= ?).
CREATE UNIQUE INDEX "uq_work_terms_owner_id_effective_from_active"
  ON "work_terms" ("owner_id", "effective_from") WHERE "deleted_at" IS NULL;

-- leave_years
ALTER TABLE "leave_years"
  ADD CONSTRAINT "ck_leave_years_year_range"
    CHECK ("year" BETWEEN 2000 AND 2100),
  ADD CONSTRAINT "ck_leave_years_allowance_minutes_range"
    CHECK ("allowance_minutes" BETWEEN 0 AND 100000);

-- One active allowance per year; also serves the list.
CREATE UNIQUE INDEX "uq_leave_years_owner_id_year_active"
  ON "leave_years" ("owner_id", "year") WHERE "deleted_at" IS NULL;

-- time_adjustments
ALTER TABLE "time_adjustments"
  ADD CONSTRAINT "ck_time_adjustments_minutes_nonzero"
    CHECK ("minutes" <> 0),
  ADD CONSTRAINT "ck_time_adjustments_minutes_range"
    CHECK ("minutes" BETWEEN -100000 AND 100000);
