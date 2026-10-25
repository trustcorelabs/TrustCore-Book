import { beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";
import { NextRequest } from "next/server";

const secret = "test-only-auth-secret-1234567890123456";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  dispatch: vi.fn(),
  authOptions: vi.fn(),
  RateLimitExceededError: class RateLimitExceededError extends Error {},
}));

vi.mock("next-auth", () => ({
  default: () => mocks.dispatch,
}));
vi.mock("@/lib/auth", () => ({ authOptions: mocks.authOptions }));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  RateLimitExceededError: mocks.RateLimitExceededError,
}));

import { GET, POST } from "@/app/api/auth/[...nextauth]/route";

function request(method: "GET" | "POST", action: string) {
  return new Request(`http://localhost/api/auth/${action}`, { method });
}

function context(action: string) {
  return { params: Promise.resolve({ nextauth: action.split("/") }) };
}

async function signedRequest(sessionId: string) {
  const token = await encode({
    token: { sub: "u1", sid: sessionId },
    secret,
    maxAge: 28800,
  });
  return new NextRequest("http://localhost/api/auth/signout", {
    method: "POST",
    headers: { cookie: `next-auth.session-token=${token}` },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.dispatch.mockResolvedValue(
    new Response("Auth.js dispatch", { status: 200 }),
  );
  mocks.authOptions.mockReturnValue({ secret, useSecureCookies: false });
});

describe("Auth.js route throttling (downstream Auth.js dispatch mocked)", () => {
  it.each([
    ["callback/credentials", "auth-post:callback"],
    ["signin/credentials", "auth-post:signin"],
    ["session", "auth-post:session:anonymous"],
    ["unknown", "auth-post:other"],
  ])("charges the %s POST to %s", async (action, bucket) => {
    const response = await POST(request("POST", action), context(action));
    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith(bucket, 200, 60);
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it("keeps a verified logout independent of an exhausted sign-in quota", async () => {
    mocks.rateLimit.mockImplementation((identity: string) =>
      identity === "auth-post:callback"
        ? Promise.reject(new mocks.RateLimitExceededError())
        : Promise.resolve(),
    );
    const response = await POST(await signedRequest("s1"), context("signout"));
    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith(
      "auth-post:signout:session:s1",
      30,
      60,
    );
    expect(mocks.dispatch).toHaveBeenCalledOnce();
  });

  it("isolates authenticated logout quotas by verified session", async () => {
    await POST(await signedRequest("s1"), context("signout"));
    await POST(await signedRequest("s2"), context("signout"));
    expect(mocks.rateLimit.mock.calls.map(([identity]) => identity)).toEqual([
      "auth-post:signout:session:s1",
      "auth-post:signout:session:s2",
    ]);
  });

  it("charges unauthenticated logout to a separate bounded bucket", async () => {
    await POST(request("POST", "signout"), context("signout"));
    expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith(
      "auth-post:signout:anonymous",
      200,
      60,
    );
  });

  it.each([
    ["signout/credentials", "signout/credentials"],
    ["callback/credentials", "signout"],
    ["signout", "callback/credentials"],
    ["signout?action=logout", "signout?action=logout"],
  ])(
    "does not exempt a malformed or mismatched action path %s",
    async (path, action) => {
      const response = await POST(request("POST", path), context(action));
      expect(response.status).toBe(200);
      expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith(
        "auth-post:other",
        200,
        60,
      );
    },
  );

  it("does not trust a query action to exempt a callback", async () => {
    const response = await POST(
      request("POST", "callback/credentials?action=signout"),
      context("callback/credentials"),
    );
    expect(response.status).toBe(200);
    expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith(
      "auth-post:callback",
      200,
      60,
    );
  });

  it.each([
    ["%73ignout", "signout"],
    ["signout/", "signout"],
    ["signout?next=callback", "signout?next=callback"],
  ])(
    "does not grant a session bucket to a noncanonical path %s",
    async (path, action) => {
      await POST(request("POST", path), context(action));
      expect(mocks.rateLimit).toHaveBeenCalledExactlyOnceWith(
        "auth-post:other",
        200,
        60,
      );
    },
  );

  it("returns 429 for an exhausted verified-session logout bucket", async () => {
    mocks.rateLimit.mockRejectedValue(new mocks.RateLimitExceededError());
    const response = await POST(await signedRequest("s1"), context("signout"));
    expect(response.status).toBe(429);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("returns 429 only for an exhausted quota and does not dispatch", async () => {
    mocks.rateLimit.mockRejectedValue(new mocks.RateLimitExceededError());
    const response = await POST(
      request("POST", "callback/credentials"),
      context("callback/credentials"),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("returns 503 for rate-store failure without presenting it as quota exhaustion", async () => {
    mocks.rateLimit.mockRejectedValue(new Error("database unavailable"));
    const response = await POST(
      request("POST", "callback/credentials"),
      context("callback/credentials"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Authentication temporarily unavailable. Try again later.",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("does not charge the POST bucket for a GET", async () => {
    const response = await GET(request("GET", "csrf"), context("csrf"));
    expect(response.status).toBe(200);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("returns a private 503 when GET auth configuration is invalid", async () => {
    mocks.authOptions.mockImplementation(() => {
      throw new Error("private configuration details");
    });
    const response = await GET(
      request("GET", "providers"),
      context("providers"),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Authentication temporarily unavailable. Try again later.",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("contains asynchronous auth dispatch failures without exposing details", async () => {
    mocks.dispatch.mockRejectedValue(new Error("private database URL"));
    const response = await GET(request("GET", "session"), context("session"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database URL");
  });
});
