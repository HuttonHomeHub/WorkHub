-- Conversion in whole blocks (docs/features/hours-tracker.md → rule 6,
-- changed 2026-09-23 at the owner's request). Additive: existing terms take
-- the default 0:30 block. A constant default on ADD COLUMN is a metadata-only
-- change in PostgreSQL 11+, so there is no table rewrite.
ALTER TABLE "work_terms" ADD COLUMN "conversion_block_minutes" INTEGER NOT NULL DEFAULT 30;

-- 1–480 minutes (@repo/types CONVERSION_BLOCK_MIN_MINUTES and
-- CONVERSION_BLOCK_MAX_MINUTES): at least a minute (a 1-minute block is
-- minute-by-minute levelling), at most 8:00.
ALTER TABLE "work_terms"
  ADD CONSTRAINT "ck_work_terms_conversion_block_range"
    CHECK ("conversion_block_minutes" BETWEEN 1 AND 480);
