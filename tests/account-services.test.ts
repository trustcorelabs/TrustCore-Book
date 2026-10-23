import { hash } from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { RateLimitExceededError } from "@/server/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserSession: vi.fn(),
  requireUser: vi.fn(),
  rateLimit: vi.fn(),
  listOwnSessions: vi.fn(),
  revokeOwnSession: vi.fn(),
  revokeAllOwnSessions: vi.fn(),
  findOwnPassword: vi.fn(),
  replaceOwnPasswordAndRevokeSessions: vi.fn(),
  createOwnedBusiness: vi.fn(),
  updateOwnName: vi.fn(),
}));
vi.mock("@/server/authorization", () => ({
  requireUserSession: mocks.requireUserSession,
  requireUser: mocks.requireUser,
}));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  RateLimitExceededError: class RateLimitExceededError extends Error {},
}));
vi.mock("@/server/repositories/identity", () => ({
  listOwnSessions: mocks.listOwnSessions,
  revokeOwnSession: mocks.revokeOwnSession,
  revokeAllOwnSessions: mocks.revokeAllOwnSessions,
  findOwnPassword: mocks.findOwnPassword,
  replaceOwnPasswordAndRevokeSessions:
    mocks.replaceOwnPasswordAndRevokeSessions,
  updateOwnName: mocks.updateOwnName,
}));
vi.mock("@/server/repositories/workspace", () => ({
  createOwnedBusiness: mocks.createOwnedBusiness,
}));

import {
  changeOwnPasswordService,
  getOwnAccountService,
  revokeAllOwnSessionsService,
  revokeOwnSessionService,
  updateOwnProfileService,
  createBusinessService,
} from "@/server/services";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUserSession.mockResolvedValue({
    id: "s1",
    userId: "u1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    expiresAt: new Date("2026-01-01T08:00:00Z"),
    revokedAt: null,
    user: {
      name: "Owner",
      email: "owner@example.com",
      credentialVersion: 0,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
  });
  mocks.requireUser.mockResolvedValue({ id: "u1" });
});

describe("own-account services (authorization and database mocked)", () => {
  it("marks only the authenticated session current and returns safe metadata", async () => {
    mocks.listOwnSessions.mockResolvedValue([
      {
        id: "s1",
        createdAt: new Date(),
        expiresAt: new Date(),
        revokedAt: null,
      },
    ]);
    const result = await getOwnAccountService();
    expect(mocks.listOwnSessions).toHaveBeenCalledExactlyOnceWith("u1", 0);
    expect(result.sessions[0]).toMatchObject({ id: "s1", current: true });
    expect(result.profile).not.toHaveProperty("passwordHash");
  });

  it("keeps the current session visible when the bounded list omits it", async () => {
    mocks.listOwnSessions.mockResolvedValue(
      Array.from({ length: 100 }, (_, index) => ({
        id: `other-${index}`,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        expiresAt: new Date("2026-01-01T08:00:00Z"),
        revokedAt: null,
      })),
    );
    const result = await getOwnAccountService();
    expect(result.sessions).toHaveLength(100);
    expect(result.sessions[0]).toMatchObject({ id: "s1", current: true });
    expect(result.sessions.filter((row) => row.current)).toHaveLength(1);
  });

  it("rejects malformed session IDs before a repository mutation", async () => {
    expect(await revokeOwnSessionService("")).toEqual({
      error: "Invalid session.",
    });
    expect(mocks.revokeOwnSession).not.toHaveBeenCalled();
  });

  it("accepts opaque session IDs without assuming a CUID format", async () => {
    const opaqueId = "7e0bc617-9771-4b3d-b60d-b138b164e3f8";
    await revokeOwnSessionService(opaqueId);
    expect(mocks.revokeOwnSession).toHaveBeenCalledWith("u1", opaqueId);
  });

  it("uses only authenticated owner ID for revoke-one and revoke-all", async () => {
    const sid = "c123456789012345678901234";
    expect(await revokeOwnSessionService(sid)).toMatchObject({
      signedOut: false,
    });
    expect(mocks.revokeOwnSession).toHaveBeenCalledExactlyOnceWith("u1", sid);
    expect(await revokeAllOwnSessionsService()).toMatchObject({
      signedOut: true,
    });
    expect(mocks.revokeAllOwnSessions).toHaveBeenCalledExactlyOnceWith("u1");
  });

  it("requires the current password and invalidates all sessions after change", async () => {
    const currentPassword = "current correct password";
    mocks.findOwnPassword.mockResolvedValue({
      passwordHash: await hash(currentPassword, 4),
    });
    mocks.replaceOwnPasswordAndRevokeSessions.mockResolvedValue(true);
    expect(
      await changeOwnPasswordService({
        currentPassword: "wrong password",
        newPassword: "a new strong password",
      }),
    ).toHaveProperty("error", "Current password is incorrect.");
    expect(mocks.replaceOwnPasswordAndRevokeSessions).not.toHaveBeenCalled();
    expect(
      await changeOwnPasswordService({
        currentPassword,
        newPassword: "a new strong password",
      }),
    ).toMatchObject({ signedOut: true });
    expect(mocks.replaceOwnPasswordAndRevokeSessions).toHaveBeenCalledWith(
      "u1",
      expect.any(String),
      expect.any(String),
    );
  });

  it("rejects password reuse without changing the hash or revoking sessions", async () => {
    const currentPassword = "current correct password";
    mocks.findOwnPassword.mockResolvedValue({
      passwordHash: await hash(currentPassword, 4),
    });
    expect(
      await changeOwnPasswordService({
        currentPassword,
        newPassword: currentPassword,
      }),
    ).toEqual({ error: "Choose a different password." });
    expect(mocks.replaceOwnPasswordAndRevokeSessions).not.toHaveBeenCalled();
  });

  it("updates only the authenticated user's validated profile name", async () => {
    expect(
      await updateOwnProfileService({
        name: "  New Owner  ",
        email: "other@example.com",
      }),
    ).toEqual({ success: "Profile updated." });
    expect(mocks.updateOwnName).toHaveBeenCalledExactlyOnceWith(
      "u1",
      "New Owner",
    );
  });

  it("onboards with the authenticated actor, never a submitted owner ID", async () => {
    mocks.createOwnedBusiness.mockResolvedValue({ id: "b1" });
    const input = {
      name: "Book Studio",
      slug: "book-studio",
      country: "LK",
      timezone: "Asia/Colombo",
      ownerId: "attacker",
    };
    expect(await createBusinessService(input)).toEqual({ businessId: "b1" });
    expect(mocks.createOwnedBusiness).toHaveBeenCalledWith("u1", {
      name: "Book Studio",
      slug: "book-studio",
      country: "LK",
      timezone: "Asia/Colombo",
    });
  });

  it.each([
    [
      new Prisma.PrismaClientKnownRequestError("Duplicate", {
        code: "P2002",
        clientVersion: "test",
      }),
      "This booking address is already taken. Go back and choose a different booking address.",
    ],
    [
      new RateLimitExceededError(),
      "Too many attempts. Please try again later.",
    ],
    [
      new Error("Database unavailable"),
      "Unable to create this business. Please try again later.",
    ],
  ])(
    "explains onboarding failures without exposing internals: %s",
    async (error, message) => {
      mocks.createOwnedBusiness.mockRejectedValue(error);
      expect(
        await createBusinessService({
          name: "Book Studio",
          slug: "book-studio",
          country: "LK",
          timezone: "Asia/Colombo",
        }),
      ).toEqual({ error: message });
    },
  );

  it("blocks newly unverified identities from business onboarding", async () => {
    mocks.requireUser.mockResolvedValue({
      id: "u1",
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    expect(await createBusinessService({})).toEqual({
      error: "Verify your email before creating a business.",
    });
    expect(mocks.createOwnedBusiness).not.toHaveBeenCalled();
  });

  it("does not reach onboarding storage when authentication fails", async () => {
    mocks.requireUser.mockRejectedValue(new Error("unauthenticated"));
    await expect(createBusinessService({})).rejects.toThrow("unauthenticated");
    expect(mocks.createOwnedBusiness).not.toHaveBeenCalled();
  });
});
