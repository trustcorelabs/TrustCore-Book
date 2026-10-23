import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { issueAccountToken } from "@/server/account-tokens";
import { approvedTestDatabase } from "./development-database-target";

const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/db", () => ({
  db: () => {
    if (!holder.client)
      throw new Error("Disposable test client not initialized");
    return holder.client;
  },
}));
import {
  createSession,
  findActiveSession,
  redeemResetToken,
  redeemVerificationToken,
} from "@/server/repositories/identity";

const url = process.env.A1_TEST_DATABASE_URL;
const approved =
  process.env.A1_TEST_DATABASE_VERIFIED === "YES" &&
  !!url &&
  (() => {
    try {
      return approvedTestDatabase(url);
    } catch {
      return false;
    }
  })();
const suite = approved ? describe : describe.skip;
const userId = `a1-${randomUUID()}`;

suite(
  "Phase A1 PostgreSQL security integration (verified disposable database only)",
  () => {
    beforeAll(async () => {
      holder.client = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url!, max: 2 }),
      });
      await holder.client.user.create({
        data: {
          id: userId,
          email: `${userId}@example.test`,
          name: "A1 test",
          passwordHash: "test-only-hash",
          emailVerificationRequired: true,
        },
      });
    });
    afterAll(async () => {
      if (holder.client) {
        await holder.client.user.delete({ where: { id: userId } });
        await holder.client.$disconnect();
        holder.client = null;
      }
    });

    it("allows exactly one concurrent verification redemption and rejects replay", async () => {
      const token = issueAccountToken("VERIFY_EMAIL", 60);
      await holder.client!.accountSecurityToken.create({
        data: {
          userId,
          purpose: "VERIFY_EMAIL",
          digest: token.digest,
          expiresAt: token.expiresAt,
        },
      });
      const results = await Promise.all([
        redeemVerificationToken(token.digest),
        redeemVerificationToken(token.digest),
      ]);
      expect(results.sort()).toEqual([false, true]);
      expect(await redeemVerificationToken(token.digest)).toBe(false);
      expect(
        (await holder.client!.user.findUniqueOrThrow({ where: { id: userId } }))
          .emailVerifiedAt,
      ).not.toBeNull();
    });

    it("expires tokens, revokes sessions and invalidates a stale-login version", async () => {
      const expired = issueAccountToken("RESET_PASSWORD", 30, new Date(0));
      await holder.client!.accountSecurityToken.create({
        data: {
          userId,
          purpose: "RESET_PASSWORD",
          digest: expired.digest,
          expiresAt: expired.expiresAt,
        },
      });
      expect(await redeemResetToken(expired.digest, "new-hash")).toBe(false);
      const session = await createSession(
        userId,
        0,
        new Date(Date.now() + 60_000),
      );
      expect(session).not.toBeNull();
      const token = issueAccountToken("RESET_PASSWORD", 30);
      await holder.client!.accountSecurityToken.create({
        data: {
          userId,
          purpose: "RESET_PASSWORD",
          digest: token.digest,
          expiresAt: token.expiresAt,
        },
      });
      expect(await redeemResetToken(token.digest, "new-hash")).toBe(true);
      expect(await findActiveSession(session!.id, userId)).toBeNull();
      expect(
        await createSession(userId, 0, new Date(Date.now() + 60_000)),
      ).toBeNull();
      expect(await redeemResetToken(token.digest, "another-hash")).toBe(false);
    });
  },
);
