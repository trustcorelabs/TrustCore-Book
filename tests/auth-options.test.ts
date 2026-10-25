import { hash } from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  findCredentialsUser: vi.fn(),
  createSession: vi.fn(),
  findActiveSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  getEnv: () => ({ NEXTAUTH_SECRET: "test-only-auth-secret-1234567890123456" }),
}));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  RateLimitExceededError: class RateLimitExceededError extends Error {},
}));
vi.mock("@/server/repositories/identity", () => ({
  findCredentialsUser: mocks.findCredentialsUser,
  createSession: mocks.createSession,
  findActiveSession: mocks.findActiveSession,
  revokeSession: mocks.revokeSession,
}));

import { authOptions } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validation";

it("normalizes surrounding spaces and case before validating account emails", () => {
  const credentials = {
    email: "  OWNER@EXAMPLE.COM  ",
    password: "a long test password",
  };
  expect(loginSchema.parse(credentials).email).toBe("owner@example.com");
  expect(registerSchema.parse({ ...credentials, name: "Owner" }).email).toBe(
    "owner@example.com",
  );
});

function authorize(credentials: Record<string, string>) {
  const provider = authOptions().providers[0];
  if (!provider || !("options" in provider) || !provider.options?.authorize)
    throw new Error("Credentials provider missing");
  return provider.options.authorize(credentials, {} as Request);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("CURRENT Credentials authorize behavior (identity and quota storage mocked)", () => {
  it("charges the normalized email before lookup and rejects an exhausted account quota", async () => {
    mocks.rateLimit.mockRejectedValue(new Error("quota exhausted"));
    await expect(
      authorize({ email: "OWNER@EXAMPLE.COM", password: "valid input" }),
    ).rejects.toThrow("Authentication temporarily unavailable.");
    expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith(
      "login:owner@example.com",
      10,
    );
    expect(mocks.findCredentialsUser).not.toHaveBeenCalled();
  });

  it("rejects invalid credential shape before quota or lookup", async () => {
    expect(
      await authorize({ email: "not-an-email", password: "x" }),
    ).toBeNull();
    expect(
      await authorize({ email: "user@example.com", password: "" }),
    ).toBeNull();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.findCredentialsUser).not.toHaveBeenCalled();
  });

  it("checks a real bcrypt hash and returns only the sign-in user projection", async () => {
    const password = "correct horse battery";
    mocks.findCredentialsUser.mockResolvedValue({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      passwordHash: await hash(password, 4),
      platformAdmin: true,
      credentialVersion: 2,
      emailVerificationRequired: false,
    });
    expect(
      await authorize({
        email: "OWNER@EXAMPLE.COM",
        password: "wrong password",
      }),
    ).toBeNull();
    expect(await authorize({ email: "OWNER@EXAMPLE.COM", password })).toEqual({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      credentialVersion: 2,
    });
    expect(mocks.findCredentialsUser).toHaveBeenCalledWith("owner@example.com");
  });

  it("rejects an unknown account with the configured dummy-hash path", async () => {
    mocks.findCredentialsUser.mockResolvedValue(null);
    expect(
      await authorize({
        email: "absent@example.com",
        password: "some password",
      }),
    ).toBeNull();
    expect(mocks.rateLimit).toHaveBeenCalledWith(
      "login:absent@example.com",
      10,
    );
  });
  it("rejects newly pending accounts but preserves the legacy exemption", async () => {
    const password = "correct horse battery";
    mocks.findCredentialsUser.mockResolvedValue({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      passwordHash: await hash(password, 4),
      credentialVersion: 0,
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    expect(
      await authorize({ email: "owner@example.com", password }),
    ).toBeNull();
    mocks.findCredentialsUser.mockResolvedValue({
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      passwordHash: await hash(password, 4),
      credentialVersion: 0,
      emailVerificationRequired: false,
      emailVerifiedAt: null,
    });
    expect(
      await authorize({ email: "owner@example.com", password }),
    ).toMatchObject({ id: "u1" });
  });
});

describe("CURRENT password boundaries", () => {
  it("accepts 72 ASCII bytes and rejects 73 at registration", () => {
    const input = {
      name: "Owner",
      email: "owner@example.com",
      password: "a".repeat(72),
    };
    expect(registerSchema.safeParse(input).success).toBe(true);
    expect(
      registerSchema.safeParse({ ...input, password: "a".repeat(73) }).success,
    ).toBe(false);
  });

  it("applies the same UTF-8 byte ceiling to login and registration", () => {
    const password = "\u00e9".repeat(40);
    expect(password.length).toBe(40);
    expect(new TextEncoder().encode(password).length).toBe(80);
    expect(
      loginSchema.safeParse({ email: "owner@example.com", password }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        name: "Owner",
        email: "owner@example.com",
        password,
      }).success,
    ).toBe(false);
  });
});

describe("CURRENT Auth.js JWT/session callbacks (database helpers mocked)", () => {
  it("creates a fixed eight-hour row once when a user signs in", async () => {
    const options = authOptions();
    expect(options.session).toMatchObject({ strategy: "jwt", maxAge: 28800 });
    expect(options.jwt).toMatchObject({ maxAge: 28800 });
    mocks.createSession.mockResolvedValue({ id: "s1" });
    const jwt = options.callbacks?.jwt;
    if (!jwt) throw new Error("JWT callback missing");
    const before = Date.now();
    const token = await jwt({
      token: { sub: "u1" },
      user: { id: "u1" },
    } as Parameters<typeof jwt>[0]);
    const after = Date.now();
    expect(token.sid).toBe("s1");
    expect(mocks.createSession).toHaveBeenCalledWith("u1", 0, expect.any(Date));
    const expiry = mocks.createSession.mock.calls[0]?.[2] as Date;
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 28800_000);
    expect(expiry.getTime()).toBeLessThanOrEqual(after + 28800_000);
    await jwt({ token } as Parameters<typeof jwt>[0]);
    expect(mocks.createSession).toHaveBeenCalledTimes(1);
  });
  it("does not issue a JWT sid if a password change wins before session creation", async () => {
    mocks.createSession.mockResolvedValue(null);
    const jwt = authOptions().callbacks?.jwt;
    if (!jwt) throw new Error("JWT callback missing");
    await expect(
      jwt({
        token: { sub: "u1" },
        user: { id: "u1", credentialVersion: 0 },
      } as Parameters<typeof jwt>[0]),
    ).rejects.toThrow("Authentication state changed");
  });

  it("redacts a revoked or expired row and does not expose its ID", async () => {
    mocks.findActiveSession.mockResolvedValue(null);
    const session = authOptions().callbacks?.session;
    if (!session) throw new Error("Session callback missing");
    const result = await session({
      session: { user: { id: "u1" }, expires: "2099-01-01T00:00:00.000Z" },
      token: { sub: "u1", sid: "s1" },
    } as Parameters<typeof session>[0]);
    expect(mocks.findActiveSession).toHaveBeenCalledWith("s1", "u1");
    expect(result).toMatchObject({
      sessionId: "",
      expires: "1970-01-01T00:00:00.000Z",
    });
    expect(result.user).toMatchObject({ id: "" });
  });

  it("reports the database expiry and revokes the JWT sid on sign-out", async () => {
    mocks.findActiveSession.mockResolvedValue({
      id: "s1",
      expiresAt: new Date("2030-01-01T08:00:00Z"),
    });
    const options = authOptions();
    const session = options.callbacks?.session;
    if (!session) throw new Error("Session callback missing");
    const result = await session({
      session: { user: { id: "u1" }, expires: "2030-01-02T00:00:00.000Z" },
      token: { sub: "u1", sid: "s1" },
    } as Parameters<typeof session>[0]);
    expect(result).toMatchObject({
      sessionId: "s1",
      expires: "2030-01-01T08:00:00.000Z",
    });
    const signOut = options.events?.signOut;
    if (!signOut) throw new Error("Sign-out event missing");
    await signOut({ token: { sid: "s1" } } as Parameters<typeof signOut>[0]);
    expect(mocks.revokeSession).toHaveBeenCalledExactlyOnceWith("s1");
  });
});

it.each([
  ["/app", "https://preview.example/app"],
  ["https://preview.example/account", "https://preview.example/account"],
  ["//attacker.example/app", "https://preview.example"],
  ["/\\attacker.example", "https://preview.example"],
  ["https://user:private@preview.example/app", "https://preview.example"],
  ["https://[malformed", "https://preview.example"],
])("keeps auth redirects on the same origin for %s", async (url, expected) => {
  const redirect = authOptions().callbacks!.redirect!;
  expect(await redirect({ url, baseUrl: "https://preview.example" })).toBe(
    expected,
  );
});
