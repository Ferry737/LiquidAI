-- server/prisma/migrations/20260728000000_v17_mainnet_security/migration.sql
-- LiquidAI v1.7: policy, mainnet acknowledgment, per-chain engine rails,
-- append-only audit log, and conservative seed state.

ALTER TYPE "ActionStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';

ALTER TABLE "positions"
  ADD COLUMN "mainnetEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "engine_states"
  ADD COLUMN "chainId" INTEGER,
  ADD COLUMN "pauseReason" TEXT,
  ADD COLUMN "pausedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "engine_states_chainId_key" ON "engine_states"("chainId");

CREATE TABLE "policy_configs" (
  "id" TEXT NOT NULL,
  "chainId" INTEGER NOT NULL,
  "maxUsdPerAction" DOUBLE PRECISION NOT NULL,
  "maxActionsPerPositionPerDay" INTEGER NOT NULL,
  "maxDailyGasUsd" DOUBLE PRECISION NOT NULL,
  "allowedPoolsJson" TEXT NOT NULL DEFAULT '[]',
  "allowedTokensJson" TEXT NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedBy" TEXT,
  CONSTRAINT "policy_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "policy_configs_chainId_key" ON "policy_configs"("chainId");

CREATE TABLE "mainnet_acknowledgments" (
  "id" TEXT NOT NULL,
  "positionId" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mainnet_acknowledgments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mainnet_acknowledgments_signature_key"
  ON "mainnet_acknowledgments"("signature");
CREATE INDEX "mainnet_acknowledgments_positionId_ts_idx"
  ON "mainnet_acknowledgments"("positionId", "ts");
ALTER TABLE "mainnet_acknowledgments"
  ADD CONSTRAINT "mainnet_acknowledgments_positionId_fkey"
  FOREIGN KEY ("positionId") REFERENCES "positions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "beforeJson" TEXT,
  "afterJson" TEXT,
  "reqId" TEXT,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_ts_idx" ON "audit_logs"("ts");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- Defense in depth: even accidental raw SQL cannot mutate an audit row.
CREATE OR REPLACE FUNCTION liquidai_reject_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION liquidai_reject_audit_mutation();

-- Conservative policy defaults. Mainnet: $500/action, 4/day, $50 gas/day.
INSERT INTO "policy_configs"
  ("id", "chainId", "maxUsdPerAction", "maxActionsPerPositionPerDay", "maxDailyGasUsd", "updatedAt")
VALUES
  ('policy-sepolia', 11155111, 100000, 100, 10000, CURRENT_TIMESTAMP),
  ('policy-arbitrum-sepolia', 421614, 100000, 100, 10000, CURRENT_TIMESTAMP),
  ('policy-base-sepolia', 84532, 100000, 100, 10000, CURRENT_TIMESTAMP),
  ('policy-ethereum', 1, 500, 4, 50, CURRENT_TIMESTAMP),
  ('policy-arbitrum', 42161, 500, 4, 50, CURRENT_TIMESTAMP),
  ('policy-base', 8453, 500, 4, 50, CURRENT_TIMESTAMP)
ON CONFLICT ("chainId") DO NOTHING;

-- Per-chain rows coexist with the existing global singleton (chainId NULL).
INSERT INTO "engine_states"
  ("id", "chainId", "running", "dryRun", "updatedAt")
VALUES
  ('chain:11155111', 11155111, true, true, CURRENT_TIMESTAMP),
  ('chain:421614', 421614, true, true, CURRENT_TIMESTAMP),
  ('chain:84532', 84532, true, true, CURRENT_TIMESTAMP),
  ('chain:1', 1, true, true, CURRENT_TIMESTAMP),
  ('chain:42161', 42161, true, true, CURRENT_TIMESTAMP),
  ('chain:8453', 8453, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("chainId") DO NOTHING;
