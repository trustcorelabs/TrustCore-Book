import { describe, expect, it, vi } from "vitest";
import {
  parsePreviewDatabase,
  verifyPreviewNeon,
  previewProject,
  previewBranch,
} from "../scripts/verify-preview-neon.mjs";
import {
  approvedNeonOrganization,
  approvedNeonEndpoint,
  approvedNeonHostname,
} from "../scripts/neon-auth.mjs";

const host = approvedNeonHostname;
const url = `postgresql://fixture:private@${host}/neondb?sslmode=verify-full`;
function metadata(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (target: string) => {
    let body: unknown;
    if (target.endsWith("/databases"))
      body = { databases: [{ name: "neondb", branch_id: previewBranch }] };
    else if (target.endsWith("/endpoints"))
      body = {
        endpoints: [
          {
            id: approvedNeonEndpoint,
            host,
            branch_id: previewBranch,
            project_id: previewProject,
            type: "read_write",
            ...overrides,
          },
        ],
      };
    else if (target.endsWith(`/branches/${previewBranch}`))
      body = { branch: { id: previewBranch, project_id: previewProject } };
    else
      body = {
        project: {
          id: previewProject,
          name: "trustcore-book-dev",
          org_id: approvedNeonOrganization,
        },
      };
    return { ok: true, json: async () => body };
  });
}

describe("Preview endpoint metadata verification (no database or real API calls)", () => {
  it.each([url, url.replace(host, host.replace(".", "-pooler."))])(
    "maps both direct and pooled URLs to the independently returned endpoint",
    async (value) => {
      const fetcher = metadata();
      expect(
        await verifyPreviewNeon(
          value,
          "synthetic-api-key-" + "x".repeat(40),
          fetcher,
        ),
      ).toEqual({
        projectId: previewProject,
        branchId: previewBranch,
        hostname: host,
        database: "neondb",
      });
      expect(fetcher).toHaveBeenCalledTimes(4);
      for (const [target] of fetcher.mock.calls) {
        expect(target).toContain(`/projects/${previewProject}`);
        expect(target).not.toContain("quiet-mouse-55892784");
        expect(target).not.toContain("private");
      }
    },
  );
  it.each([
    { id: "ep-other" },
    { project_id: "quiet-mouse-55892784" },
    { branch_id: "br-original" },
    { host: "ep-different.c-7.us-east-2.aws.neon.tech" },
    { disabled: true },
    { type: "read_only" },
  ])(
    "refuses unrelated, disabled and read-only endpoints",
    async (override) => {
      await expect(
        verifyPreviewNeon(
          url,
          "synthetic-api-key-" + "x".repeat(40),
          metadata(override),
        ),
      ).rejects.toThrow("identity could not be verified");
    },
  );
  it("does not echo API errors or secrets", async () => {
    await expect(
      verifyPreviewNeon(url, "private-api-key-" + "x".repeat(40), async () => {
        throw new Error(url);
      }),
    ).rejects.toThrow("Neon project metadata: network/TLS failure");
  });
  it.each(["wrong-organization", "cloned-branch"])(
    "independently refuses %s",
    async (mismatch) => {
      const original = metadata();
      const fetcher = async (target: string) => {
        if (
          mismatch === "wrong-organization" &&
          target.endsWith(`/projects/${previewProject}`)
        )
          return {
            ok: true,
            json: async () => ({
              project: {
                id: previewProject,
                name: "trustcore-book-dev",
                org_id: "org-other",
              },
            }),
          };
        if (
          mismatch === "cloned-branch" &&
          target.endsWith(`/branches/${previewBranch}`)
        )
          return {
            ok: true,
            json: async () => ({
              branch: {
                id: previewBranch,
                project_id: previewProject,
                parent_id: "br-unapproved",
              },
            }),
          };
        return original(target);
      };
      await expect(
        verifyPreviewNeon(url, "synthetic-api-key-" + "x".repeat(40), fetcher),
      ).rejects.toThrow("identity could not be verified");
    },
  );
  it("rejects unencrypted, unrelated, ambiguous or missing credentials before any API request", async () => {
    for (const value of [
      url.replace("verify-full", "require"),
      url.replace("/neondb", "/production"),
      url.replace("fixture:private@", ""),
      `${url}&sslmode=require`,
      url.replace(host, "attacker.example"),
    ]) {
      expect(parsePreviewDatabase(value)).toBeNull();
      const fetcher = metadata();
      await expect(
        verifyPreviewNeon(
          value,
          "synthetic-api-key-" + "x".repeat(40),
          fetcher,
        ),
      ).rejects.toThrow("Invalid Preview database input");
      expect(fetcher).not.toHaveBeenCalled();
    }
  });
  it("rejects a database metadata response from a different branch", async () => {
    const delegate = metadata();
    await expect(
      verifyPreviewNeon(
        url,
        "synthetic-api-key-" + "x".repeat(40),
        async (target: string) =>
          target.endsWith("/databases")
            ? {
                ok: true,
                json: async () => ({
                  databases: [{ name: "neondb", branch_id: "br-other" }],
                }),
              }
            : delegate(target),
      ),
    ).rejects.toThrow("identity could not be verified");
  });
});
