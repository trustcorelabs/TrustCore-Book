import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { approvedDevelopmentDatabase } from "./development-database-target";

// This test never starts a server. The caller must independently verify that
// the running app uses the same disposable Neon branch before opting in.
function smokeConfig() {
  if (
    process.env.AUTH_SMOKE_APPROVED !== "YES" ||
    process.env.AUTH_SMOKE_BRANCH_VERIFIED !== "YES"
  )
    return null;
  const {
    AUTH_SMOKE_BASE_URL,
    AUTH_SMOKE_DATABASE_URL,
    AUTH_SMOKE_EMAIL,
    AUTH_SMOKE_PASSWORD,
  } = process.env;
  if (
    !AUTH_SMOKE_BASE_URL ||
    !AUTH_SMOKE_DATABASE_URL ||
    !AUTH_SMOKE_EMAIL ||
    !AUTH_SMOKE_PASSWORD
  )
    return null;
  try {
    const app = new URL(AUTH_SMOKE_BASE_URL);
    const database = new URL(AUTH_SMOKE_DATABASE_URL);
    const localHost =
      app.hostname === "localhost" ||
      app.hostname === "127.0.0.1" ||
      app.hostname === "::1" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(app.hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(app.hostname);
    if (
      !["http:", "https:"].includes(app.protocol) ||
      !localHost ||
      app.pathname !== "/" ||
      app.search ||
      app.hash ||
      app.username ||
      app.password ||
      !approvedDevelopmentDatabase(AUTH_SMOKE_DATABASE_URL) ||
      database.searchParams.get("sslmode") !== "verify-full"
    )
      return null;
    return {
      baseUrl: app.origin,
      email: AUTH_SMOKE_EMAIL,
      password: AUTH_SMOKE_PASSWORD,
    };
  } catch {
    return null;
  }
}

const config = smokeConfig();

describe("opt-in disposable-database login smoke test", () => {
  it.skipIf(!config)(
    "does not expose credentials in URLs, persists a session, and signs out",
    async () => {
      if (!config) throw new Error("Smoke target is not verified");
      const browser = await chromium.launch({ channel: "chrome" });
      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        const visited: string[] = [];
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame()) visited.push(frame.url());
        });
        await page.goto(`${config.baseUrl}/login`);
        await page.getByLabel("Email address").fill(config.email);
        await page.getByLabel("Password").fill(config.password);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(/\/app(?:\/|$)/);
        await page.reload();
        expect(new URL(page.url()).pathname).toMatch(/^\/app(?:\/|$)/);
        expect(
          visited.every((url) => {
            const query = new URL(url).searchParams;
            return !query.has("password") && !query.has("email");
          }),
        ).toBe(true);
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.waitForURL(/\/login(?:\?|$)/);
        await page.goto(`${config.baseUrl}/app`);
        await page.waitForURL(/\/login(?:\?|$)/);
        await context.close();
      } catch {
        throw new Error(
          "Disposable login smoke test failed; inspect the app without sharing credentials",
        );
      } finally {
        await browser.close();
      }
    },
  );

  it.skipIf(!config)(
    "fails closed without client JavaScript instead of using GET",
    async () => {
      if (!config) throw new Error("Smoke target is not verified");
      const browser = await chromium.launch({ channel: "chrome" });
      try {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto(`${config.baseUrl}/login`);
        await page.getByLabel("Email address").fill("nobody@example.test");
        await page.getByLabel("Password").fill("non-secret-test-value");
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForLoadState("domcontentloaded");
        const query = new URL(page.url()).searchParams;
        expect(query.has("password") || query.has("email")).toBe(false);
        await context.close();
      } finally {
        await browser.close();
      }
    },
  );
});
