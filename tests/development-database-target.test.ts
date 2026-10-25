import { describe, expect, it } from "vitest";
import {
  approvedDevelopmentDatabase,
  approvedLocalDatabase,
  approvedCiDatabase,
} from "./development-database-target";

const host = "ep-rapid-lake-b406ul3l.c-6.us-east-2.aws.neon.tech";
const url = `postgresql://test:test@${host}/neondb?sslmode=verify-full`;
const env = {
  DEV_NEON_TARGET_VERIFIED: "YES",
  DEV_NEON_PROJECT_ID: "divine-dawn-11566468",
  DEV_NEON_BRANCH_ID: "br-nameless-fog-b4cigm8d",
  DEV_NEON_ENDPOINT: host,
};

describe("disposable rehearsal database test gate", () => {
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
        url.replace(host, host.replace(".", "-pooler.")),
        {
          ...env,
          DEV_NEON_ENDPOINT: host.replace(".", "-pooler."),
        },
      ),
    ).toBe(false);
  });
  it.each([
    "br-bold-heart-b42fnp9k",
    "br-autumn-queen-b50gugiv",
    "br-dark-brook-b4vdolwu",
  ])("rejects parent, Production and obsolete branch %s", (branchId) => {
    expect(
      approvedDevelopmentDatabase(url, {
        ...env,
        DEV_NEON_BRANCH_ID: branchId,
      }),
    ).toBe(false);
  });
  it("rejects an endpoint substitution even when the caller supplies matching metadata", () => {
    const otherHost = "ep-other.c-6.us-east-2.aws.neon.tech";
    expect(
      approvedDevelopmentDatabase(url.replace(host, otherHost), {
        ...env,
        DEV_NEON_ENDPOINT: otherHost,
      }),
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
