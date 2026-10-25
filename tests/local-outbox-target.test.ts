import { describe, expect, it } from "vitest";
import {
  assertLocalNeonMetadata,
  localOutboxTarget,
} from "@/server/local-outbox-target";

const host = "ep-wild-cloud-b52apabm.c-7.us-east-2.aws.neon.tech";
const database = "trustcore_book_a1_test";
const env = {
  NODE_ENV: "development",
  ACCOUNT_EMAIL_PROVIDER: "local",
  LOCAL_OUTBOX_ENABLED: "YES",
  LOCAL_OUTBOX_TARGET_APPROVED: "YES",
  LOCAL_OUTBOX_EXPECTED_ENDPOINT: host,
  LOCAL_OUTBOX_EXPECTED_DATABASE: database,
  LOCAL_OUTBOX_NEON_PROJECT_ID: "quiet-mouse-55892784",
  LOCAL_OUTBOX_NEON_BRANCH_ID: "br-late-sunset-b5k5go82",
  LOCAL_OUTBOX_NEON_BRANCH_NAME: "trustcore-book-a1-test",
  LOCAL_OUTBOX_NEON_API_KEY: "test-only-api-key",
  LOCAL_OUTBOX_ACCESS_TOKEN: "A".repeat(43),
  NEXTAUTH_URL: "http://localhost:3000",
  DATABASE_URL: `postgresql://test:test@${host}/${database}?sslmode=verify-full`,
};

describe("local outbox target guards (pure, no database connection)", () => {
  it("accepts only the dedicated development project's default neondb target", () => {
    const dev = {
      ...env,
      LOCAL_OUTBOX_NEON_PROJECT_ID: "fragrant-hat-50630079",
      LOCAL_OUTBOX_NEON_BRANCH_ID: "br-dark-brook-b4vdolwu",
      LOCAL_OUTBOX_NEON_BRANCH_NAME: "production",
      LOCAL_OUTBOX_EXPECTED_DATABASE: "neondb",
      DATABASE_URL: `postgresql://test:test@${host}/neondb?sslmode=verify-full`,
    };
    const target = localOutboxTarget(dev)!;
    expect(target).toMatchObject({
      database: "neondb",
      projectId: "fragrant-hat-50630079",
    });
    const branch = {
      id: target.branchId,
      name: "production",
      default: true,
      parent_id: null,
      protected: false,
    };
    const endpoint = {
      host,
      branch_id: target.branchId,
      project_id: target.projectId,
      type: "read_write",
    };
    expect(() =>
      assertLocalNeonMetadata(target, branch, [endpoint]),
    ).not.toThrow();
    expect(() =>
      assertLocalNeonMetadata(target, { ...branch, protected: true }, [
        endpoint,
      ]),
    ).not.toThrow();
    expect(() =>
      assertLocalNeonMetadata(target, branch, [
        { ...endpoint, project_id: "quiet-mouse-55892784" },
      ]),
    ).toThrow();
    expect(
      localOutboxTarget({
        ...dev,
        LOCAL_OUTBOX_NEON_PROJECT_ID: "quiet-mouse-55892784",
      }),
    ).toBeNull();
    expect(
      localOutboxTarget({ ...dev, LOCAL_OUTBOX_NEON_BRANCH_ID: "br-other" }),
    ).toBeNull();
    expect(localOutboxTarget({ ...dev, NODE_ENV: "production" })).toBeNull();
  });
  it("requires explicit disposable direct-connection and developer gates", () => {
    expect(localOutboxTarget(env)).toMatchObject({
      host,
      database,
      origin: "http://localhost:3000",
    });
    expect(localOutboxTarget({ ...env, NODE_ENV: "production" })).toBeNull();
    expect(localOutboxTarget({ ...env, LOCAL_OUTBOX_ENABLED: "" })).toBeNull();
    expect(
      localOutboxTarget({ ...env, LOCAL_OUTBOX_TARGET_APPROVED: "" }),
    ).toBeNull();
    expect(
      localOutboxTarget({ ...env, LOCAL_OUTBOX_ACCESS_TOKEN: "short" }),
    ).toBeNull();
    expect(
      localOutboxTarget({ ...env, NEXTAUTH_URL: "http://192.168.1.10:3000" }),
    ).toBeNull();
    expect(
      localOutboxTarget({
        ...env,
        DATABASE_URL: env.DATABASE_URL.replace(host, "prod.example.com"),
      }),
    ).toBeNull();
    expect(
      localOutboxTarget({
        ...env,
        DATABASE_URL: env.DATABASE_URL.replace("verify-full", "require"),
      }),
    ).toBeNull();
    expect(
      localOutboxTarget({
        ...env,
        DIRECT_URL:
          "postgresql://test:test@localhost/other_test?sslmode=verify-full",
      }),
    ).toBeNull();
  });

  it("requires live metadata for the intended nondefault, unprotected branch and endpoint", () => {
    const target = localOutboxTarget(env)!;
    const branch = {
      id: target.branchId,
      name: target.branchName,
      parent_id: "br-parent",
      protected: false,
      expires_at: "2099-01-01T00:00:00.000Z",
    };
    const endpoint = {
      host,
      branch_id: target.branchId,
      project_id: target.projectId,
      type: "read_write",
    };
    expect(() =>
      assertLocalNeonMetadata(target, branch, [endpoint]),
    ).not.toThrow();
    expect(() =>
      assertLocalNeonMetadata(target, { ...branch, protected: true }, [
        endpoint,
      ]),
    ).toThrow();
    expect(() =>
      assertLocalNeonMetadata(target, { ...branch, expires_at: "2020-01-01" }, [
        endpoint,
      ]),
    ).toThrow();
    expect(() =>
      assertLocalNeonMetadata(target, branch, [
        { ...endpoint, branch_id: "br-other" },
      ]),
    ).toThrow();
  });
});

it.each(["preview", "production"])(
  "rejects hosted %s even if NODE_ENV is accidentally development",
  (environment) => {
    expect(
      localOutboxTarget({ ...env, VERCEL: "1", VERCEL_ENV: environment }),
    ).toBeNull();
    expect(localOutboxTarget({ ...env, VERCEL_ENV: environment })).toBeNull();
  },
);
