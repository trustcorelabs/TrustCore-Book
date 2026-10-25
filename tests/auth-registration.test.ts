import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  createCredentialsUser: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@/server/account-email", () => ({
  accountEmailDelivery: () => ({ configured: false, send: mocks.send }),
}));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  RateLimitExceededError: class RateLimitExceededError extends Error {},
}));
vi.mock("@/server/repositories/identity", () => ({
  createCredentialsUser: mocks.createCredentialsUser,
}));
vi.mock("@/server/repositories/workspace", () => ({
  createOwnedBusiness: vi.fn(),
  insertRecord: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("@/server/authorization", () => ({
  requireTenant: vi.fn(),
  requireUser: vi.fn(),
}));

import { registerAccountService } from "@/server/services";

const input = {
  name: "Owner",
  email: "OWNER@EXAMPLE.COM",
  password: "a sufficiently long password",
};
const message =
  "If this address is available, you can sign in with your password.";

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());

describe("registration without email verification (repository mocked)", () => {
  it("creates a login account without an email provider or verification token", async () => {
    mocks.createCredentialsUser.mockResolvedValue({ id: "u1" });
    expect(await registerAccountService(input)).toEqual({ success: message });
    expect(mocks.rateLimit).toHaveBeenCalledWith("registration:global", 100);
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      "register:owner@example.com",
      5,
    );
    expect(mocks.createCredentialsUser).toHaveBeenCalledWith({
      name: "Owner",
      email: "owner@example.com",
      passwordHash: expect.any(String),
    });
    expect(
      mocks.createCredentialsUser.mock.calls[0]?.[0].passwordHash,
    ).not.toBe(input.password);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("uses the same response for an already registered email", async () => {
    const { Prisma } = await import("@/generated/prisma/client");
    mocks.createCredentialsUser.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "7.10.1",
      }),
    );
    expect(await registerAccountService(input)).toEqual({ success: message });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("reports storage failures without claiming account creation", async () => {
    mocks.createCredentialsUser.mockRejectedValue(new Error("storage failed"));
    expect(await registerAccountService(input)).toEqual({
      error: "Registration is temporarily unavailable. Please try again later.",
    });
  });

  it("identifies missing local configuration without exposing values", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.rateLimit.mockRejectedValue(
      new Error("Server environment is incomplete. See .env.example."),
    );
    expect(await registerAccountService(input)).toEqual({
      error:
        "Local server configuration is incomplete. Check the required settings in .env.example.",
    });
  });
  it("fails closed on missing hosted configuration before account creation", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.rateLimit.mockRejectedValue(
      new Error("Server environment is incomplete. See .env.example."),
    );
    expect(await registerAccountService(input)).toEqual({
      error: "Registration is temporarily unavailable. Please try again later.",
    });
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1);
    expect(mocks.createCredentialsUser).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects an empty action probe before configuration, quota or persistence", async () => {
    expect(await registerAccountService({})).toHaveProperty("error");
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.createCredentialsUser).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("identifies a development connection timeout without echoing its details", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.rateLimit.mockRejectedValue({
      code: "ETIMEDOUT",
      message: "a private connection string",
    });
    expect(await registerAccountService(input)).toEqual({
      error:
        "The development database connection failed. Check the verified disposable branch, endpoint, credentials and network access.",
    });
  });

  it("identifies a missing development table without applying migrations", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.rateLimit.mockRejectedValue({ code: "P2021" });
    expect(await registerAccountService(input)).toEqual({
      error:
        "The development database is missing required tables or columns. Check migration status on the verified disposable branch.",
    });
  });

  it("keeps production database errors generic", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.rateLimit.mockRejectedValue({ code: "P2021" });
    expect(await registerAccountService(input)).toEqual({
      error: "Registration is temporarily unavailable. Please try again later.",
    });
  });

  it("gives safe local guidance for an unknown storage failure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.rateLimit.mockRejectedValue(
      new Error("private database connection details"),
    );
    expect(await registerAccountService(input)).toEqual({
      error:
        "Local registration failed. Check the verified development database connection and migration status.",
    });
  });

  it("rejects invalid input before quota or persistence", async () => {
    expect(
      await registerAccountService({ ...input, password: "short" }),
    ).toHaveProperty("error");
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.createCredentialsUser).not.toHaveBeenCalled();
  });

  it("does not depend on a configured email gateway", async () => {
    mocks.createCredentialsUser.mockResolvedValue({ id: "u1" });
    expect(await registerAccountService(input)).toEqual({ success: message });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
