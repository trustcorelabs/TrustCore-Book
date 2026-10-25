import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseClient } from "@/server/repositories/database-client";
import { issueAccountToken } from "@/server/account-tokens";
import { approvedTestDatabase } from "./development-database-target";

const holder = vi.hoisted(() => ({ client: null as PrismaClient | null }));
vi.mock("@/lib/db", () => ({
  db: () => {
    if (!holder.client) throw new Error("Disposable A2 client not initialized");
    return holder.client;
  },
}));
import {
  createInvitation,
  redeemInvitation,
  transferOwnership,
} from "@/server/repositories/invitations";
import {
  createSession,
  findActiveSession,
  redeemResetToken,
} from "@/server/repositories/identity";

const url = process.env.A2_TEST_DATABASE_URL;
const approved =
  process.env.A2_TEST_DATABASE_VERIFIED === "YES" &&
  !!url &&
  approvedTestDatabase(url);
const suite = approved ? describe : describe.skip;
const suffix = randomUUID();
const ids = {
  business: `a2-business-${suffix}`,
  owner: `a2-owner-${suffix}`,
  invitee: `a2-invitee-${suffix}`,
  other: `a2-other-${suffix}`,
  cascadeBusiness: `a2-cascade-business-${suffix}`,
  cascadeOwner: `a2-cascade-owner-${suffix}`,
};

suite(
  "Phase A2 PostgreSQL security integration (externally verified disposable target only)",
  () => {
    beforeAll(async () => {
      holder.client = createDatabaseClient(url!, 4);
      const migrations = await holder.client.$queryRaw<
        { migration_name: string }[]
      >`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
      const names = new Set(migrations.map((row) => row.migration_name));
      for (const required of [
        "20261018000000_initial",
        "20261018010000_phase_a1_identity",
        "20261019010000_phase_a2_invitations",
        "20261019020000_phase_a2_final_owner_guard",
      ])
        if (!names.has(required))
          throw new Error(
            `Required disposable-test migration missing: ${required}`,
          );

      const users: [string, string][] = [
        [ids.owner, `owner-${suffix}@example.test`],
        [ids.invitee, `invitee-${suffix}@example.test`],
        [ids.other, `other-${suffix}@example.test`],
        [ids.cascadeOwner, `cascade-${suffix}@example.test`],
      ];
      for (const [id, email] of users)
        await holder.client.user.create({
          data: {
            id,
            email,
            name: "A2 test",
            passwordHash: "test-only-hash",
            emailVerifiedAt: new Date(),
          },
        });
      await holder.client.business.create({
        data: {
          id: ids.business,
          slug: ids.business,
          name: "A2 test",
          country: "LK",
          currency: "LKR",
          timezone: "Asia/Colombo",
          members: {
            create: [
              { userId: ids.owner, role: "OWNER" },
              { userId: ids.other, role: "MEMBER" },
            ],
          },
        },
      });
      await holder.client.business.create({
        data: {
          id: ids.cascadeBusiness,
          slug: ids.cascadeBusiness,
          name: "A2 cascade test",
          country: "LK",
          currency: "LKR",
          timezone: "Asia/Colombo",
          members: { create: { userId: ids.cascadeOwner, role: "OWNER" } },
        },
      });
    });

    afterAll(async () => {
      if (!holder.client) return;
      try {
        const businessIds = [ids.business, ids.cascadeBusiness];
        await holder.client.auditLog.deleteMany({
          where: { businessId: { in: businessIds } },
        });
        await holder.client.business.deleteMany({
          where: { id: { in: businessIds } },
        });
        await holder.client.user.deleteMany({
          where: {
            id: { in: [ids.owner, ids.invitee, ids.other, ids.cascadeOwner] },
          },
        });
      } finally {
        await holder.client.$disconnect();
        holder.client = null;
      }
    });

    it("redeems an invitation once under concurrent acceptance", async () => {
      const digest = createHash("sha256")
        .update(`INVITATION:${randomBytes(32).toString("base64url")}`)
        .digest("hex");
      await createInvitation({
        businessId: ids.business,
        actorId: ids.owner,
        email: `invitee-${suffix}@example.test`,
        role: "MEMBER",
        digest,
        expiresAt: new Date(Date.now() + 60_000),
      });
      const attempts = await Promise.allSettled([
        redeemInvitation(digest, ids.invitee, true),
        redeemInvitation(digest, ids.invitee, true),
      ]);
      expect(
        attempts.filter((attempt) => attempt.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await holder.client!.businessMember.count({
          where: { businessId: ids.business, userId: ids.invitee },
        }),
      ).toBe(1);
    });

    it("allows only one concurrent transfer from the same owner", async () => {
      const targets = await holder.client!.businessMember.findMany({
        where: {
          businessId: ids.business,
          userId: { in: [ids.invitee, ids.other] },
        },
      });
      const invitee = targets.find((target) => target.userId === ids.invitee)!;
      const other = targets.find((target) => target.userId === ids.other)!;
      const attempts = await Promise.allSettled([
        transferOwnership(ids.business, ids.owner, invitee.id),
        transferOwnership(ids.business, ids.owner, other.id),
      ]);
      expect(
        attempts.filter((attempt) => attempt.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        await holder.client!.businessMember.count({
          where: { businessId: ids.business, role: "OWNER" },
        }),
      ).toBe(1);
    });

    it("rejects final-owner membership and account deletion", async () => {
      const membership = await holder.client!.businessMember.findUniqueOrThrow({
        where: {
          businessId_userId: {
            businessId: ids.cascadeBusiness,
            userId: ids.cascadeOwner,
          },
        },
      });
      await expect(
        holder.client!.businessMember.delete({ where: { id: membership.id } }),
      ).rejects.toThrow();
      await expect(
        holder.client!.user.delete({ where: { id: ids.cascadeOwner } }),
      ).rejects.toThrow();
      expect(
        await holder.client!.businessMember.count({
          where: { businessId: ids.cascadeBusiness, role: "OWNER" },
        }),
      ).toBe(1);
    });

    it("keeps the final owner and membership when account deletion cascades", async () => {
      const owner = await holder.client!.user.findUniqueOrThrow({
        where: { id: ids.cascadeOwner },
      });
      await expect(
        holder.client!.user.delete({ where: { id: owner.id } }),
      ).rejects.toThrow();
      expect(
        await holder.client!.user.findUnique({ where: { id: owner.id } }),
      ).not.toBeNull();
      expect(
        await holder.client!.businessMember.count({
          where: { businessId: ids.cascadeBusiness, role: "OWNER" },
        }),
      ).toBe(1);
    });

    it("rolls back a partial owner promotion", async () => {
      const before = await holder.client!.businessMember.findUniqueOrThrow({
        where: {
          businessId_userId: { businessId: ids.business, userId: ids.owner },
        },
      });
      await expect(
        holder.client!.$transaction(async (tx) => {
          await tx.businessMember.update({
            where: { id: before.id },
            data: { role: "OWNER" },
          });
          throw new Error("test rollback");
        }),
      ).rejects.toThrow("test rollback");
      expect(
        (
          await holder.client!.businessMember.findUniqueOrThrow({
            where: { id: before.id },
          })
        ).role,
      ).toBe(before.role);
    });

    it("never leaves a stale-version session active across reset", async () => {
      const user = await holder.client!.user.findUniqueOrThrow({
        where: { id: ids.owner },
      });
      const token = issueAccountToken("RESET_PASSWORD", 30);
      await holder.client!.accountSecurityToken.create({
        data: {
          userId: ids.owner,
          purpose: "RESET_PASSWORD",
          digest: token.digest,
          expiresAt: token.expiresAt,
        },
      });
      const [sessionResult, resetResult] = await Promise.all([
        createSession(
          ids.owner,
          user.credentialVersion,
          new Date(Date.now() + 60_000),
        ),
        redeemResetToken(token.digest, "new-test-hash"),
      ]);
      expect(resetResult).toBe(true);
      if (sessionResult)
        expect(await findActiveSession(sessionResult.id, ids.owner)).toBeNull();
    });
  },
);
