// server/src/lib/db.ts
// Prisma client singleton. Created lazily so tests that mock the repository
// never need a live DATABASE_URL.

import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "production"
          ? ["error", "warn"]
          : ["error", "warn"],
    });
  }
  return prisma;
}

/** Eagerly connect — called on server boot. */
export async function connectDb(): Promise<void> {
  await getDb().$connect();
}

/** Disconnect — called on graceful shutdown. */
export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Check if a DATABASE_URL is configured. When false, persistence features
 * gracefully degrade (the API still serves live subgraph data via cache).
 */
export function hasDatabase(): boolean {
  const url = process.env.DATABASE_URL;
  return !!url && url.startsWith("postgres");
}
