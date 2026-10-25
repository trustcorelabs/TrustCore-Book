import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  runSetup,
  strictTLS,
  previewPlan,
  verifyBuildContract,
  type SetupIO,
  type PreviewEnv,
} from "../scripts/setup-preview.mjs";
import { expectedPreview } from "../scripts/verify-preview-target.mjs";
import {
  approvedNeonProject as projectId,
  approvedNeonBranch as branchId,
  approvedNeonOrganization,
  approvedNeonEndpoint,
  approvedNeonHostname as host,
} from "../scripts/neon-auth.mjs";
const secret = "unit-test-private-password";
const uri = `postgresql://fixture_owner:${secret}@${host}/neondb?sslmode=require&channel_binding=require`;
const apiKey = "unit-test-private-api-key-" + "x".repeat(32);
const operationId = "12345678-1234-1234-1234-123456789abc";
function fixture(answers = [apiKey, "ROTATE DEV", "WRITE PREVIEW", ""]) {
  const env: PreviewEnv[] = [];
  const project = {
    id: expectedPreview.projectId,
    accountId: expectedPreview.orgId,
    name: expectedPreview.projectName,
    framework: "nextjs",
    outputDirectory: null,
    rootDirectory: null,
    autoExposeSystemEnvs: true,
    buildCommand: "pnpm build",
    installCommand: "pnpm install --frozen-lockfile",
    env,
  };
  const log = vi.fn();
  const writes: { args: string[]; input?: string }[] = [];
  const inputs = [...answers];
  const neon = vi.fn(async (path: string, _key: string, method: string) => {
    expect(_key).toBe(apiKey);
    if (method === "POST") {
      expect(path).toBe(
        `/branches/${branchId}/roles/fixture_owner/reset_password`,
      );
      return {
        role: { name: "fixture_owner", branch_id: branchId, password: secret },
        operations: [
          { id: operationId, project_id: projectId, branch_id: branchId },
        ],
      };
    }
    if (path.startsWith("/operations/"))
      return {
        operation: {
          id: operationId,
          project_id: projectId,
          branch_id: branchId,
          status: "finished",
        },
      };
    if (path === "")
      return {
        project: {
          id: projectId,
          name: "trustcore-book-dev",
          org_id: approvedNeonOrganization,
        },
      };
    if (path === `/branches/${branchId}`)
      return { branch: { id: branchId, project_id: projectId } };
    if (path.endsWith("/roles"))
      return {
        roles: [
          {
            name: "fixture_owner",
            branch_id: branchId,
            authentication_method: "password",
            protected: false,
          },
        ],
      };
    if (path.endsWith("/databases"))
      return {
        databases: [
          { name: "neondb", branch_id: branchId, owner_name: "fixture_owner" },
        ],
      };
    if (path === "/endpoints")
      return {
        endpoints: [
          {
            id: approvedNeonEndpoint,
            host,
            project_id: projectId,
            branch_id: branchId,
            type: "read_write",
          },
        ],
      };
    if (path.startsWith("/connection_uri?")) {
      const q = new URLSearchParams(path.split("?")[1]);
      expect(q.get("pooled")).toBe("false");
      expect(q.get("branch_id")).toBe(branchId);
      return { uri };
    }
    throw new Error("Unexpected Neon request");
  });
  const cli = vi.fn(async (args: string[], input?: string) => {
    if (args[0] === "api") {
      if (args[1]!.startsWith("/v13/"))
        return JSON.stringify({
          projectId: expectedPreview.projectId,
          ownerId: expectedPreview.orgId,
          target: null,
          readyState: "READY",
          meta: { localSourceSha256: "fixture-digest" },
        });
      return JSON.stringify(project);
    }
    if (args[0] === "deploy")
      return args.includes("--dry")
        ? JSON.stringify({ files: [] })
        : "https://trustcore-book-fixture.vercel.app\n";
    if (args[0] === "curl")
      return args[1]!.endsWith("outbox")
        ? "\n404"
        : args[1]!.endsWith("providers")
          ? '{"credentials":{"signinUrl":"https://trustcore-book-fixture.vercel.app/api/auth/signin/credentials"}}\n200'
          : "{}\n200";
    if (args[0] === "env") {
      writes.push({ args, input });
      const key = args[2]!;
      if (args[1] === "remove") {
        const index = env.findIndex(
          (e) => e.key === key && e.target.includes("preview"),
        );
        if (index >= 0) env.splice(index, 1);
      } else env.push({ key, target: ["preview"] });
      return "private CLI output that must not be printed";
    }
    throw new Error("Unexpected Vercel request");
  });
  const io: SetupIO = {
    cli,
    neon,
    log,
    prompt: vi.fn(async () => inputs.shift() ?? ""),
    link: () => ({
      projectId: expectedPreview.projectId,
      orgId: expectedPreview.orgId,
    }),
    source: vi.fn(() => ({ sha256: "fixture-digest", files: 1 })),
    checks: vi.fn(async () => {}),
    verify: vi.fn(async () => ({ projectId })),
    wait: vi.fn(async () => {}),
  };
  return { io, project, env, writes, cli, neon, log };
}

describe("one-command Preview setup with all external effects mocked", () => {
  it("changes only sslmode with URL parsing, preserving encoding and other parameters", () => {
    const input =
      "postgresql://user:p%40ss@host.test/db?sslmode=require&channel_binding=require&application_name=fixture";
    const url = new URL(strictTLS(input));
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("channel_binding")).toBe("require");
    expect(url.searchParams.get("application_name")).toBe("fixture");
    expect(decodeURIComponent(url.password)).toBe("p@ss");
  });
  it.each([
    { envs: [{ key: "DATABASE_URL", target: ["preview", "production"] }] },
    { envs: [{ key: "DATABASE_URL", target: ["preview"], gitBranch: "main" }] },
    { envs: [{ key: "VERCEL_URL", target: ["preview"] }] },
    {
      envs: [
        { key: "DATABASE_URL", target: ["preview"] },
        { key: "DATABASE_URL", target: ["preview"] },
      ],
    },
  ])("refuses shared, branch-specific and ambiguous settings", ({ envs }) => {
    expect(() => previewPlan(envs)).toThrow();
  });
  it("requires rotation and write consent, then passes secrets only on stdin and does not deploy by default", async () => {
    const f = fixture();
    await runSetup(f.io);
    expect(f.writes).toHaveLength(7);
    expect(f.io.verify).toHaveBeenCalledWith(strictTLS(uri), apiKey);
    for (const write of f.writes) {
      expect(write.args).toContain("--sensitive");
      expect(write.args).toContain("preview");
      expect(write.args).not.toContain("production");
      expect(write.args.join(" ")).not.toContain(secret);
      expect(write.args).not.toContain("--value");
    }
    expect(f.writes.find((w) => w.args[2] === "DATABASE_URL")?.input).toBe(
      strictTLS(uri) + "\n",
    );
    expect(
      f.writes.find((w) => w.args[2] === "BOOKING_MVP_ENABLED")?.input,
    ).toBe("false\n");
    expect(
      f.writes.find((w) => w.args[2] === "A2_MEMBERSHIP_ENABLED")?.input,
    ).toBe("false\n");
    expect(
      f.writes.find((w) => w.args[2] === "ACCOUNT_EMAIL_PROVIDER")?.input,
    ).toBe("disabled\n");
    expect(
      f.cli.mock.calls.some(
        ([args]) => args[0] === "deploy" && !args.includes("--dry"),
      ),
    ).toBe(false);
    const output = JSON.stringify(f.log.mock.calls);
    for (const value of [secret, apiKey, uri, "private CLI output"])
      expect(output).not.toContain(value);
  });
  it("cancels before rotation and any Vercel write when consent is absent", async () => {
    const f = fixture([apiKey, ""]);
    await runSetup(f.io);
    expect(f.neon.mock.calls.some((call) => call[2] === "POST")).toBe(false);
    expect(f.writes).toHaveLength(0);
  });
  it("does not change Vercel when write confirmation is declined", async () => {
    const f = fixture([apiKey, "ROTATE DEV", ""]);
    await runSetup(f.io);
    expect(f.writes).toHaveLength(0);
  });
  it("accepts an already-rotated hidden password without invoking reset", async () => {
    const f = fixture([apiKey, "FRESH", secret, "WRITE PREVIEW", ""]);
    await runSetup(f.io);
    expect(f.neon.mock.calls.some((call) => call[2] === "POST")).toBe(false);
    expect(f.writes).toHaveLength(7);
  });
  it("refuses the wrong Vercel project before asking for credentials", async () => {
    const f = fixture();
    f.project.id = "wrong-project";
    await expect(runSetup(f.io)).rejects.toThrow();
    expect(f.io.prompt).not.toHaveBeenCalled();
    expect(f.writes).toHaveLength(0);
  });
  it("refuses mismatched ownership before any rotation or write", async () => {
    const f = fixture();
    const original = f.io.neon;
    f.io.neon = async (...args) =>
      args[0] === ""
        ? { project: { id: "quiet-mouse-55892784", name: "production" } }
        : original(...args);
    await expect(runSetup(f.io)).rejects.toThrow(
      "ownership verification failed",
    );
    expect(f.neon.mock.calls.some((call) => call[2] === "POST")).toBe(false);
    expect(f.writes).toHaveLength(0);
  });
  it("does not assign credentials when independent URI verification fails", async () => {
    const f = fixture();
    f.io.verify = async () => {
      throw new Error("verification denied");
    };
    await expect(runSetup(f.io)).rejects.toThrow();
    expect(f.writes).toHaveLength(0);
  });
  it.each(["wrong-organization", "cloned-branch"])(
    "refuses %s before rotation or Vercel writes",
    async (mismatch) => {
      const f = fixture();
      const original = f.io.neon;
      f.io.neon = async (...args) => {
        if (mismatch === "wrong-organization" && args[0] === "")
          return {
            project: {
              id: projectId,
              name: "trustcore-book-dev",
              org_id: "org-other",
            },
          };
        if (mismatch === "cloned-branch" && args[0] === `/branches/${branchId}`)
          return {
            branch: {
              id: branchId,
              project_id: projectId,
              parent_id: "br-unapproved",
            },
          };
        return original(...args);
      };
      await expect(runSetup(f.io)).rejects.toThrow(
        "ownership verification failed",
      );
      expect(f.neon.mock.calls.some((call) => call[2] === "POST")).toBe(false);
      expect(f.writes).toHaveLength(0);
    },
  );
  it("uses Preview-only remove/add for replacements, never env update", async () => {
    const f = fixture();
    f.env.push(
      { key: "DATABASE_URL", target: ["preview"] },
      { key: "NEXTAUTH_URL", target: ["preview"] },
    );
    await runSetup(f.io);
    expect(f.writes.some((w) => w.args[1] === "update")).toBe(false);
    expect(
      f.writes.filter((w) => w.args[1] === "remove").map((w) => w.args[2]),
    ).toEqual(["DATABASE_URL", "NEXTAUTH_URL"]);
    expect(f.env.some((e) => e.key === "NEXTAUTH_URL")).toBe(false);
  });
  it("deploys only after separate confirmation and verifies source and runtime without SQL calls", async () => {
    const f = fixture([
      apiKey,
      "ROTATE DEV",
      "WRITE PREVIEW",
      "DEPLOY PREVIEW",
    ]);
    await runSetup(f.io);
    const actual = f.cli.mock.calls.filter(
      ([args]) => args[0] === "deploy" && !args.includes("--dry"),
    );
    expect(actual).toHaveLength(1);
    expect(actual[0]![0]).toContain("preview");
    expect(actual[0]![0]).not.toContain("--prod");
    expect(f.log).toHaveBeenCalledWith("PASS Preview /api/dev/outbox HTTP 404");
  });
  it("aborts deployment if current source changed after checks", async () => {
    const f = fixture([
      apiKey,
      "ROTATE DEV",
      "WRITE PREVIEW",
      "DEPLOY PREVIEW",
    ]);
    f.io.source = vi
      .fn()
      .mockReturnValueOnce({ files: 1, sha256: "before" })
      .mockReturnValueOnce({ files: 1, sha256: "after" });
    await expect(runSetup(f.io)).rejects.toThrow("Source changed");
    expect(
      f.cli.mock.calls.some(
        ([args]) => args[0] === "deploy" && !args.includes("--dry"),
      ),
    ).toBe(false);
  });
});

const auditedPackage = JSON.parse(readFileSync("package.json", "utf8"));
const auditedConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
it("accepts the existing build contract and refuses migration/seed hooks before checks", () => {
  expect(() =>
    verifyBuildContract(auditedPackage, auditedConfig),
  ).not.toThrow();
  for (const scripts of [
    { ...auditedPackage.scripts, build: "prisma migrate deploy" },
    { ...auditedPackage.scripts, prebuild: "pnpm seed:dev" },
  ])
    expect(() => verifyBuildContract({ scripts }, auditedConfig)).toThrow(
      "Build hooks/configuration changed",
    );
  expect(() =>
    verifyBuildContract(auditedPackage, {
      ...auditedConfig,
      env: { DATABASE_URL: "unsafe" },
    }),
  ).toThrow();
});

it("supports official CLI authentication without fabricating an API key or asking for one", async () => {
  const f = fixture(["ROTATE DEV", "WRITE PREVIEW", ""]);
  f.io.authenticate = async () => ({
    request: (full, method = "GET") =>
      f.neon(full.slice(`/projects/${projectId}`.length), apiKey, method),
  });
  await runSetup(f.io);
  expect(f.writes).toHaveLength(7);
  expect(f.io.verify).not.toHaveBeenCalled(); // Independent verification used the authenticated request adapter.
});
