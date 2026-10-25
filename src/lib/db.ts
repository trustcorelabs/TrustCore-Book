import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseClient } from "@/server/repositories/database-client";
import { getEnv } from "./env";
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
export function db() {
  if (!globalDb.prisma)
    globalDb.prisma = createDatabaseClient(getEnv().DATABASE_URL);
  return globalDb.prisma;
}
