import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/server/repositories/database-client";
import { approvedTestDatabase } from "./development-database-target";

const url = process.env.TEST_DATABASE_URL;
const suite = url && approvedTestDatabase(url) ? describe : describe.skip;

suite(
  "cold pool transaction acquisition on verified disposable database",
  () => {
    it("opens concurrent transactions before any pool warm-up query", async () => {
      const client = createDatabaseClient(url!, 2);
      try {
        const rows = await Promise.all(
          [0, 1].map(() =>
            client.$transaction(
              (tx) => tx.$queryRaw<{ value: number }[]>`
            SELECT 1::integer AS value
          `,
            ),
          ),
        );
        expect(rows).toEqual([[{ value: 1 }], [{ value: 1 }]]);
      } finally {
        await client.$disconnect();
      }
    }, 60_000);
    it("finishes a multi-query transaction over the remote connection", async () => {
      const client = createDatabaseClient(url!, 1);
      try {
        await client.$queryRaw`SELECT 1`;
        const values = await client.$transaction(async (tx) => {
          const results: number[] = [];
          for (let index = 0; index < 10; index++) {
            const rows = await tx.$queryRaw<{ value: number }[]>`
              SELECT 1::integer AS value
            `;
            results.push(rows[0]!.value);
          }
          return results;
        });
        expect(values).toEqual(Array(10).fill(1));
      } finally {
        await client.$disconnect();
      }
    }, 45_000);
  },
);
