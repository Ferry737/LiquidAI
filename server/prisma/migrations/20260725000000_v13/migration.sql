-- v1.3 migration: notification settings + engine state

CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "telegramChatId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "onRebalance" BOOLEAN NOT NULL DEFAULT true,
    "onCompound" BOOLEAN NOT NULL DEFAULT true,
    "onStopLoss" BOOLEAN NOT NULL DEFAULT true,
    "onFailure" BOOLEAN NOT NULL DEFAULT true,
    "onOutOfRangeHrs" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_settings_owner_key" ON "notification_settings"("owner");

CREATE TABLE "engine_states" (
    "id" TEXT NOT NULL,
    "running" BOOLEAN NOT NULL DEFAULT true,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "engine_states_pkey" PRIMARY KEY ("id")
);

-- Seed the singleton engine state row
INSERT INTO "engine_states" ("id", "running", "dryRun", "updatedAt")
VALUES ('singleton', true, true, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
