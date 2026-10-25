import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createDatabaseClient(connectionString: string, max = 5) {
  const connectionTimeoutMillis = 15_000;
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max,
      connectionTimeoutMillis,
      idleTimeoutMillis: 10_000,
    }),
    // Acquisition includes pool connection establishment AND the adapter's BEGIN
    // round trip. Normal-concurrency rehearsal reproduced P2028 when both pool
    // and acquisition deadlines were 15s; allow BEGIN after the bounded connect.
    // The rehearsal also
    // reproduced P2028 during a ten-query transaction at the default 5s limit;
    // allow a bounded 15s for multi-query account operations. Booking has its
    // own measured execution budget for its longer locked transaction.
    transactionOptions: {
      maxWait: connectionTimeoutMillis + 15_000,
      timeout: 15_000,
    },
  });
}
