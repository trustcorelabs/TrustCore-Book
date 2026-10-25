import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  requiredPreviewFiles,
  verifySourceManifest,
} from "../scripts/preview-source-manifest.mjs";
const contents = Buffer.from("fixture source");
const manifest = () => ({
  files: requiredPreviewFiles.map((path: string) => ({
    path,
    sha: createHash("sha1").update(contents).digest("hex"),
  })),
});
it("verifies uploaded hashes against current local contents including uncommitted fixes", () => {
  expect(verifySourceManifest(manifest(), () => contents)).toMatchObject({
    files: requiredPreviewFiles.length,
    sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
});
it.each([
  ".env",
  ".env.local",
  ".local/database.json",
  ".aws/credentials",
  "../outside",
  "node_modules/package.json",
])("rejects unsafe upload paths before opening them (%s)", (path) => {
  const input = manifest();
  input.files.unshift({ path, sha: "a".repeat(40) });
  const read = vi.fn(() => contents);
  expect(() => verifySourceManifest(input, read)).toThrow(
    "Sensitive or unsafe file",
  );
  expect(read).not.toHaveBeenCalledWith(path);
});
it("rejects an upload missing a locally modified auth module", () => {
  expect(() => verifySourceManifest({ files: [] }, () => contents)).toThrow(
    "required source missing",
  );
});
it("rejects stale file contents", () => {
  expect(() =>
    verifySourceManifest(manifest(), () => Buffer.from("changed")),
  ).toThrow("Source changed");
});
