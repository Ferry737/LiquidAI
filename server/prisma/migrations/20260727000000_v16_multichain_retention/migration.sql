-- server/prisma/migrations/20260727000000_v16_multichain_retention/migration.sql
-- v1.6: multi-chain columns + retention aggregation table.
--
-- 1. chainId on position_snapshots, strategy_actions, pool_hour_data,
--    backtests (positions already has it) — default 11155111 (Sepolia)
--    so all existing rows are attributed to the original chain.
-- 2. pool_hour_data unique key now includes chainId.
-- 3. position_daily_snapshots: daily aggregates for the retention job.

-- ---- position_snapshots ----
ALTER TABLE "position_snapshots"
  ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 11155111;

CREATE INDEX "position_snapshots_chainId_ts_idx"
  ON "position_snapshots"("chainId", "ts");

-- ---- strategy_actions ----
ALTER TABLE "strategy_actions"
  ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 11155111;

CREATE INDEX "strategy_actions_chainId_ts_idx"
  ON "strategy_actions"("chainId", "ts");

-- ---- pool_hour_data ----
ALTER TABLE "pool_hour_data"
  ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 11155111;

-- Replace the old (poolId, ts) unique with (chainId, poolId, ts).
DROP INDEX IF EXISTS "pool_hour_data_poolId_ts_key";
DROP INDEX IF EXISTS "pool_hour_data_poolId_ts_idx";

CREATE UNIQUE INDEX "pool_hour_data_chainId_poolId_ts_key"
  ON "pool_hour_data"("chainId", "poolId", "ts");

CREATE INDEX "pool_hour_data_chainId_poolId_ts_idx"
  ON "pool_hour_data"("chainId", "poolId", "ts");

-- ---- backtests ----
ALTER TABLE "backtests"
  ADD COLUMN "chainId" INTEGER NOT NULL DEFAULT 11155111;

DROP INDEX IF EXISTS "backtests_poolId_idx";

CREATE INDEX "backtests_chainId_poolId_idx"
  ON "backtests"("chainId", "poolId");

-- ---- position_daily_snapshots (v1.6 retention) ----
CREATE TABLE "position_daily_snapshots" (
  "id" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL DEFAULT 11155111,
  "day" TIMESTAMP(3) NOT NULL,
  "avgValueUsd" DOUBLE PRECISION NOT NULL,
  "minValueUsd" DOUBLE PRECISION NOT NULL,
  "maxValueUsd" DOUBLE PRECISION NOT NULL,
  "avgUnclaimedFeesUsd" DOUBLE PRECISION NOT NULL,
  "maxUnclaimedFeesUsd" DOUBLE PRECISION NOT NULL,
  "avgIlPct" DOUBLE PRECISION NOT NULL,
  "inRangeRatio" DOUBLE PRECISION NOT NULL,
  "sampleCount" INTEGER NOT NULL,

  CONSTRAINT "position_daily_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "position_daily_snapshots_positionId_day_key"
  ON "position_daily_snapshots"("positionId", "day");

CREATE INDEX "position_daily_snapshots_chainId_day_idx"
  ON "position_daily_snapshots"("chainId", "day");

ALTER TABLE "position_daily_snapshots"
  ADD CONSTRAINT "position_daily_snapshots_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "positions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
