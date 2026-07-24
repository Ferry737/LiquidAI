-- server/prisma/migrations/20260724000000_init/migration.sql
-- LiquidAI v1.2 initial migration.

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('REBALANCE', 'COMPOUND', 'STOP_LOSS', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('EXECUTED', 'FAILED', 'DRY_RUN');

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "pool" TEXT NOT NULL,
    "token0" TEXT NOT NULL,
    "token1" TEXT NOT NULL,
    "feeTier" INTEGER NOT NULL,
    "tickLower" INTEGER NOT NULL,
    "tickUpper" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_snapshots" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liquidity" TEXT NOT NULL,
    "amount0" TEXT NOT NULL,
    "amount1" TEXT NOT NULL,
    "unclaimedFeesUsd" DOUBLE PRECISION NOT NULL,
    "valueUsd" DOUBLE PRECISION NOT NULL,
    "inRange" BOOLEAN NOT NULL,
    "ilPct" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "position_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_configs" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rebalanceAfterHrs" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "compoundMinUsd" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxSlippagePct" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "stopLossIlPct" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategy_actions" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL,
    "txHash" TEXT,
    "detailsJson" TEXT NOT NULL,

    CONSTRAINT "strategy_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "positions_chainId_tokenId_key" ON "positions"("chainId", "tokenId");

-- CreateIndex
CREATE INDEX "positions_owner_idx" ON "positions"("owner");

-- CreateIndex
CREATE INDEX "position_snapshots_positionId_ts_idx" ON "position_snapshots"("positionId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "strategy_configs_positionId_key" ON "strategy_configs"("positionId");

-- CreateIndex
CREATE INDEX "strategy_actions_positionId_ts_idx" ON "strategy_actions"("positionId", "ts");

-- AddForeignKey
ALTER TABLE "position_snapshots" ADD CONSTRAINT "position_snapshots_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_configs" ADD CONSTRAINT "strategy_configs_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategy_actions" ADD CONSTRAINT "strategy_actions_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
