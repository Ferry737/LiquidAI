-- v1.4 migration: PoolHourData (cached hourly pool data) + Backtest results.

CREATE TABLE "pool_hour_data" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "tick" INTEGER NOT NULL,
    "tvlUsd" DOUBLE PRECISION NOT NULL,
    "volumeUsd" DOUBLE PRECISION NOT NULL,
    "feesUsd" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "pool_hour_data_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pool_hour_data_poolId_ts_key" ON "pool_hour_data"("poolId", "ts");
CREATE INDEX "pool_hour_data_poolId_ts_idx" ON "pool_hour_data"("poolId", "ts");

CREATE TABLE "backtests" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3) NOT NULL,
    "paramsJson" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backtests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backtests_owner_createdAt_idx" ON "backtests"("owner", "createdAt");
CREATE INDEX "backtests_poolId_idx" ON "backtests"("poolId");
