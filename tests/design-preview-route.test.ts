import { beforeEach, expect, it, vi } from "vitest";
import { isValidElement } from "react";
const mocks = vi.hoisted(() => ({ host: "127.0.0.1:3000", headers: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("@/server/actions", () => ({}));
import Page from "@/app/dev/preview/page";
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  mocks.host = "127.0.0.1:3000";
  mocks.headers.mockImplementation(
    async () => new Headers({ host: mocks.host }),
  );
});
it("never exposes the design preview in production builds", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(mocks.headers).not.toHaveBeenCalled();
});
it("rejects non-loopback hosts even in development", async () => {
  vi.stubEnv("NODE_ENV", "development");
  mocks.host = "example.com";
  await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "NOT_FOUND",
  );
});
it.each(["127.0.0.1:3000", "localhost:3000", "[::1]:3000"])(
  "renders local preview on %s without querying a database",
  async (host) => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.host = host;
    expect(
      isValidElement(
        await Page({
          searchParams: Promise.resolve({
            view: "workspace",
            industry: "TUTORING",
          }),
        }),
      ),
    ).toBe(true);
  },
);
