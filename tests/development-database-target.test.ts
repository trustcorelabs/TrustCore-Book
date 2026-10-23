import { describe, expect, it } from "vitest";
import {
  approvedDevelopmentDatabase,
  approvedLocalDatabase,
  approvedCiDatabase,
} from "./development-database-target";

const host = "ep-example.c-7.us-east-2.aws.neon.tech";
const url = `postgresql://test:test@${host}/neondb?sslmode=verify-full`;
const env = {
  DEV_NEON_TARGET_VERIFIED: "YES",
  DEV_NEON_PROJECT_ID: "fragrant-hat-50630079",
  DEV_NEON_BRANCH_ID: "br-dark-brook-b4vdolwu",
  DEV_NEON_ENDPOINT: host,
};

describe("new development database test gate", () => {
  it("accepts only the exact externally verified project, branch and direct URL", () => {
    expect(approvedDevelopmentDatabase(url, env)).toBe(true);
    expect(
      approvedDevelopmentDatabase(url, {
        ...env,
        DEV_NEON_TARGET_VERIFIED: "",
      }),
    ).toBe(false);
    expect(
      approvedDevelopmentDatabase(url, {
        ...env,
        DEV_NEON_PROJECT_ID: "quiet-mouse-55892784",
      }),
    ).toBe(false);
    expect(
      approvedDevelopmentDatabase(url, {
        ...env,
        DEV_NEON_BRANCH_ID: "br-other",
      }),
    ).toBe(false);
    expect(
      approvedDevelopmentDatabase(
        url.replace(host, "ep-other.c-7.us-east-2.aws.neon.tech"),
        env,
      ),
    ).toBe(false);
    expect(
      approvedDevelopmentDatabase(url.replace("/neondb", "/other"), env),
    ).toBe(false);
    expect(
      approvedDevelopmentDatabase(url.replace("verify-full", "require"), env),
    ).toBe(false);
    expect(
      approvedDevelopmentDatabase(
        url.replace("ep-example", "ep-example-pooler"),
        {
          ...env,
          DEV_NEON_ENDPOINT: host.replace("ep-example", "ep-example-pooler"),
        },
      ),
    ).toBe(false);
  });
});

it("rejects unverified local and all former-production targets", () => {
  const local =
    "postgresql://trustcore_local:test@127.0.0.1:55432/trustcore_book_local";
  const gate = {
    LOCAL_TEST_DATABASE_VERIFIED: "YES",
    LOCAL_TEST_DATABASE_URL: local,
  };
  expect(approvedLocalDatabase(local, gate)).toBe(true);
  expect(approvedLocalDatabase(local, {})).toBe(false);
  for (const wrong of [
    local.replace("55432", "5432"),
    local.replace("127.0.0.1", "production.example.com"),
    local.replace("trustcore_book_local", "postgres"),
  ])
    expect(
      approvedLocalDatabase(wrong, { ...gate, LOCAL_TEST_DATABASE_URL: wrong }),
    ).toBe(false);
});

it("accepts only the workflow's exact disposable PostgreSQL service in GitHub Actions", () => {
  const url = "postgresql://trustcore_ci@localhost:5432/trustcore_ci_test";
  const env = {
    CI: "true",
    GITHUB_ACTIONS: "true",
    DIRECT_URL: url,
    TEST_DATABASE_URL: url,
  };
  expect(approvedCiDatabase(url, env)).toBe(true);
  expect(approvedCiDatabase(url, { ...env, GITHUB_ACTIONS: "" })).toBe(false);
  expect(approvedCiDatabase(url, { ...env, DIRECT_URL: "" })).toBe(false);
  for (const wrong of [
    url.replace("localhost", "production.example.com"),
    url.replace("trustcore_ci_test", "neondb"),
    url.replace("5432", "55432"),
    url + "?sslmode=require",
  ]) {
    expect(
      approvedCiDatabase(wrong, {
        ...env,
        DIRECT_URL: wrong,
        TEST_DATABASE_URL: wrong,
      }),
    ).toBe(false);
  }
});
