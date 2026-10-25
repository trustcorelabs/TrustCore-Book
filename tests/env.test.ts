import { afterEach, expect, it, vi } from "vitest";
import { getEnv } from "@/lib/env";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("reports only invalid variable names in server logs, never environment values", () => {
  vi.stubEnv("DATABASE_URL", "private-invalid-database-url");
  vi.stubEnv("NEXTAUTH_URL", "private-invalid-auth-url");
  vi.stubEnv("NEXTAUTH_SECRET", "private-secret");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => getEnv()).toThrow(
    "Server environment is incomplete. See .env.example.",
  );
  expect(log).toHaveBeenCalledExactlyOnceWith(
    "Server configuration missing or invalid:",
    "DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET",
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("private-");
});

it("requires HTTPS for production without echoing the configured origin", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://user:private@localhost/test");
  vi.stubEnv("NEXTAUTH_URL", "http://private-origin.example");
  vi.stubEnv("NEXTAUTH_SECRET", "x".repeat(32));
  expect(() => getEnv()).toThrow("Production requires HTTPS.");
});

it("uses only platform-generated Preview origins when NEXTAUTH_URL is absent", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/test");
  vi.stubEnv("NEXTAUTH_SECRET", "x".repeat(32));
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "trustcore-book-fixture-team.vercel.app");
  expect(getEnv().NEXTAUTH_URL).toBe(
    "https://trustcore-book-fixture-team.vercel.app",
  );
});

it.each([
  ["production", "trustcore-book-fixture.vercel.app"],
  ["preview", "attacker.example"],
  ["preview", "trustcore-book.vercel.app/redirect"],
  ["preview", "trustcore-book.vercel.app@attacker.example"],
])(
  "does not use an unsafe or non-Preview fallback (%s, %s)",
  (environment, host) => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/test");
    vi.stubEnv("NEXTAUTH_SECRET", "x".repeat(32));
    vi.stubEnv("NEXTAUTH_URL", undefined);
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("VERCEL_URL", host);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => getEnv()).toThrow("Server environment is incomplete.");
  },
);

it("rejects a production origin inherited into Preview instead of redirecting users there", () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/test");
  vi.stubEnv("NEXTAUTH_SECRET", "x".repeat(32));
  vi.stubEnv("NEXTAUTH_URL", "https://production.example");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "trustcore-book-preview.vercel.app");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => getEnv()).toThrow("Server environment is incomplete.");
  expect(log).toHaveBeenCalledWith(
    "Server configuration missing or invalid:",
    "NEXTAUTH_URL (Preview origin mismatch)",
  );
  expect(JSON.stringify(log.mock.calls)).not.toContain("production.example");
});

it.each([
  "https://user:secret@example.test",
  "https://example.test/path",
  "https://example.test?token=private",
  "https://example.test#token=private",
])("rejects credentials and non-origin auth URLs", (value) => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1/test");
  vi.stubEnv("NEXTAUTH_SECRET", "x".repeat(32));
  vi.stubEnv("NEXTAUTH_URL", value);
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => getEnv()).toThrow("Server environment is incomplete.");
});
