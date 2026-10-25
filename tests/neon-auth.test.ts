import { describe, expect, it, vi } from "vitest";
import {
  approvedNeonProject,
  approvedNeonBranch,
  authenticateNeon,
  assertNeonRequest,
  validateNeonApiKey,
  requestNeon,
  parseCliResponse,
} from "../scripts/neon-auth.mjs";
const path = `/projects/${approvedNeonProject}`;
const key = "synthetic-neon-key-" + "k".repeat(48);
const included = (body: unknown, status = 200) => ({
  status: 0,
  stdout: `HTTP ${status} Result\ncontent-type: application/json\n\n${JSON.stringify(body)}\n`,
  stderr: "",
});
describe("Neon authentication safety with synthetic credentials only", () => {
  it.each([
    "elevenchars",
    "",
    "npk_partial",
    "Bearer fake-token-value-that-is-not-a-key",
    "postgresql://user:private@host/db",
    '"' + key + '"',
    "partial..." + "x".repeat(40),
  ])(
    "rejects incomplete or inappropriate credentials locally",
    async (value) => {
      const fetcher = vi.fn();
      expect(() => validateNeonApiKey(value)).toThrow(
        "incomplete or malformed",
      );
      await expect(requestNeon(value, path, "GET", fetcher)).rejects.toThrow(
        "incomplete or malformed",
      );
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("normalizes accidental outer whitespace without imposing an exact token length", () => {
    expect(validateNeonApiKey(`  ${key}\n`)).toBe(key);
  });
  it.each([401, 403, 404, 429, 503])(
    "reports safe stage and actual HTTP %i, without response secrets",
    async (status) => {
      const json = vi.fn(async () => ({ secret: key }));
      const fetcher = vi.fn(async () => ({ ok: false, status, json }));
      await expect(requestNeon(key, path, "GET", fetcher)).rejects.toThrow(
        `project metadata: HTTP ${status}`,
      );
      expect(json).not.toHaveBeenCalled();
    },
  );
  it("redacts network details and labels timeouts", async () => {
    await expect(
      requestNeon(key, path, "GET", async () => {
        throw new Error(key);
      }),
    ).rejects.toThrow("network/TLS failure");
    await expect(
      requestNeon(key, path, "GET", async () => {
        throw new DOMException(key, "TimeoutError");
      }),
    ).rejects.toThrow("network timeout");
  });
  it("does not retry credential rotation after an API failure", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    }));
    await expect(
      requestNeon(
        key,
        `${path}/branches/${approvedNeonBranch}/roles/fixture/reset_password`,
        "POST",
        fetcher,
      ),
    ).rejects.toThrow("role rotation: HTTP 503");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each([
    ["/projects/quiet-mouse-55892784", "GET"],
    ["/projects/fragrant-hat-50630079", "GET"],
    ["/projects/polished-block-78280084", "GET"],
    [`${path}/branches/br-other`, "GET"],
    [`${path}/branches/${approvedNeonBranch}/databases`, "POST"],
    [
      `${path}/connection_uri?branch_id=br-other&pooled=false&database_name=neondb`,
      "GET",
    ],
  ])("refuses forbidden or unscoped API routes", (route, method) => {
    expect(() => assertNeonRequest(route, method)).toThrow();
  });
  it("captures CLI HTTP headers and JSON without exposing them", () => {
    expect(
      parseCliResponse(
        path,
        included({ project: { id: approvedNeonProject } }),
      ),
    ).toEqual({ project: { id: approvedNeonProject } });
    expect(() =>
      parseCliResponse(path, {
        status: 1,
        stdout: "",
        stderr: `HTTP 401 Unauthorized private=${key}`,
      }),
    ).toThrow("HTTP 401");
    expect(() =>
      parseCliResponse(path, included({ secret: key }, 403)),
    ).toThrow("HTTP 403");
  });
  it("uses an existing official CLI identity without prompting or extracting its token", async () => {
    const run = vi.fn(async (args: string[]) =>
      args[0] === "me"
        ? { status: 0, stdout: '{"login":"fixture-user"}', stderr: "" }
        : included({ project: { id: approvedNeonProject } }),
    );
    const prompt = vi.fn(),
      log = vi.fn();
    await authenticateNeon({ run, prompt, log, environmentKey: "" });
    expect(prompt).not.toHaveBeenCalled();
    expect(run.mock.calls.some(([args]) => args.includes("--api-key"))).toBe(
      false,
    );
  });
  it("stops on an inaccessible development target without another login or retargeting", async () => {
    const run = vi.fn(async (args: string[]) =>
      args[0] === "me"
        ? { status: 0, stdout: '{"login":"fixture-user"}', stderr: "" }
        : included({ secret: key }, 404),
    );
    const prompt = vi.fn();
    await expect(
      authenticateNeon({ run, prompt, log: () => {}, environmentKey: "" }),
    ).rejects.toThrow("this does not mean CLI login failed");
    expect(prompt).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]?.[0]).toContain(path);
    expect(run.mock.calls.flat(2).join(" ")).not.toContain("polished-block");
  });
  it("requires LOGIN before launching authentication and verifies identity afterward", async () => {
    let loggedIn = false;
    const run = vi.fn(async (args: string[], login?: boolean) => {
      if (login) {
        expect(args).toEqual(["login", "--keyring"]);
        loggedIn = true;
        return { status: 0, stdout: key, stderr: "" };
      }
      return args[0] === "me"
        ? {
            status: loggedIn ? 0 : 1,
            stdout: loggedIn ? '{"login":"fixture"}' : "",
            stderr: "",
          }
        : included({});
    });
    const log = vi.fn();
    await authenticateNeon({
      run,
      prompt: async () => "LOGIN",
      log,
      environmentKey: "",
    });
    expect(run.mock.calls.some(([, login]) => login)).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain(key);
  });
  it("does not launch a browser when authentication is cancelled", async () => {
    const run = vi.fn(async () => ({ status: 1, stdout: "", stderr: "" }));
    await expect(
      authenticateNeon({
        run,
        prompt: async () => "",
        log: () => {},
        environmentKey: "",
      }),
    ).rejects.toThrow("cancelled");
    expect(run).toHaveBeenCalledOnce();
  });
  it("rejects an 11-character entry before HTTP and allows another hidden attempt", async () => {
    const answers = ["KEY", "elevenchars", "KEY", key];
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    }));
    const log = vi.fn();
    await authenticateNeon({
      run: async () => ({ status: 1, stdout: "", stderr: "" }),
      prompt: async () => answers.shift()!,
      fetcher,
      log,
      environmentKey: "",
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain("elevenchars");
    expect(JSON.stringify(log.mock.calls)).not.toContain(key);
  });
});
