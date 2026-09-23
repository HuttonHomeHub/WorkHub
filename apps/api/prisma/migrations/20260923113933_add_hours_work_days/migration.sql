-- CreateTable
CREATE TABLE "work_days" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "starts_at" TIMESTAMPTZ(3),
    "ends_at" TIMESTAMPTZ(3),
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "leave_minutes" INTEGER NOT NULL DEFAULT 0,
    "toil_taken_minutes" INTEGER NOT NULL DEFAULT 0,
    "bank_holiday_worked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "work_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excess_conversions" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "week_start" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "excess_conversions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "work_days" ADD CONSTRAINT "work_days_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excess_conversions" ADD CONSTRAINT "excess_conversions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written: CHECK constraints and partial unique indexes (Prisma 6 cannot
-- declare them; each is listed in a comment on its model in schema.prisma).
-- Both tables are new and empty, so nothing here touches existing data.
-- ---------------------------------------------------------------------------

-- work_days
ALTER TABLE "work_days"
  ADD CONSTRAINT "ck_work_days_date_range"
    CHECK ("date" BETWEEN DATE '2000-01-01' AND DATE '2100-12-31'),
  ADD CONSTRAINT "ck_work_days_times_paired"
    CHECK (("starts_at" IS NULL) = ("ends_at" IS NULL)),
  ADD CONSTRAINT "ck_work_days_times_order"
    CHECK ("ends_at" > "starts_at"),
  ADD CONSTRAINT "ck_work_days_span_max"
    CHECK ("ends_at" - "starts_at" <= INTERVAL '24 hours'),
  ADD CONSTRAINT "ck_work_days_break_minutes_range"
    CHECK ("break_minutes" BETWEEN 0 AND 1440),
  ADD CONSTRAINT "ck_work_days_leave_minutes_range"
    CHECK ("leave_minutes" BETWEEN 0 AND 1440),
  ADD CONSTRAINT "ck_work_days_toil_taken_minutes_range"
    CHECK ("toil_taken_minutes" BETWEEN 0 AND 1440);

-- One active row per date; also serves the owner-scoped [from, to) list
-- sorted by date (owner_id = ? AND date >= ? AND date < ? ORDER BY date).
CREATE UNIQUE INDEX "uq_work_days_owner_id_date_active"
  ON "work_days" ("owner_id", "date") WHERE "deleted_at" IS NULL;

-- excess_conversions
ALTER TABLE "excess_conversions"
  ADD CONSTRAINT "ck_excess_conversions_week_start_monday"
    CHECK (EXTRACT(ISODOW FROM "week_start") = 1),
  ADD CONSTRAINT "ck_excess_conversions_week_start_range"
    CHECK ("week_start" BETWEEN DATE '2000-01-01' AND DATE '2100-12-31');

-- One active switch per week; also serves the owner-scoped week-range list.
CREATE UNIQUE INDEX "uq_excess_conversions_owner_id_week_start_active"
  ON "excess_conversions" ("owner_id", "week_start") WHERE "deleted_at" IS NULL;
