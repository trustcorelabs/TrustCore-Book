import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { expectedPreview } from "./verify-preview-target.mjs";

export const requiredPreviewFiles = [
  "src/lib/env.ts",
  "src/lib/auth.ts",
  "src/lib/db.ts",
  "src/server/repositories/database-client.ts",
  "src/server/local-outbox-target.ts",
  "src/app/api/auth/[...nextauth]/route.ts",
  "src/components/auth-form.tsx",
  "scripts/verify-preview-neon.mjs",
  "scripts/setup-preview.mjs",
  "scripts/neon-auth.mjs",
  "vercel.json",
  "package.json",
  "pnpm-lock.yaml",
];
export function verifySourceManifest(manifest, read = readFileSync) {
  if (!Array.isArray(manifest?.files))
    throw new Error("Invalid Vercel dry manifest.");
  if (
    manifest.files.some(
      (file) => !file.sha && (file.mode & 0o170000) !== 0o040000,
    )
  )
    throw new Error("Invalid Vercel dry manifest.");
  const files = manifest.files.filter((file) => file.sha);
  for (const required of requiredPreviewFiles) {
    if (!files.some((file) => file.path === required))
      throw new Error("Latest required source missing from upload manifest.");
  }
  const digest = createHash("sha256");
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/");
    if (
      file.path.startsWith("/") ||
      parts.includes("..") ||
      parts.some((part) =>
        /^(?:\.env(?:\..*)?|\.local|\.git|\.vercel|\.aws|\.codex|\.agents|node_modules)$/.test(
          part,
        ),
      )
    )
      throw new Error(
        "Sensitive or unsafe file in upload manifest. Stop deployment.",
      );
    // Never reads .env files: path rejection precedes file access.
    const contents = read(file.path);
    if (createHash("sha1").update(contents).digest("hex") !== file.sha)
      throw new Error(
        "Source changed after Vercel inspected it. Run the source check again.",
      );
    digest.update(file.path).update("\0").update(contents).update("\0");
  }
  return { files: files.length, sha256: digest.digest("hex") };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const result = spawnSync(
      "vercel",
      [
        "deploy",
        "--dry",
        "--json",
        "--environment",
        "preview",
        "--project",
        expectedPreview.projectId,
        "--scope",
        expectedPreview.scope,
        "--non-interactive",
      ],
      { encoding: "utf8", timeout: 30000, maxBuffer: 8 * 1024 * 1024 },
    );
    if (result.status !== 0)
      throw new Error("Vercel dry inspection failed. No deployment created.");
    const verified = verifySourceManifest(JSON.parse(result.stdout));
    console.log(JSON.stringify(verified));
  } catch (error) {
    console.error(
      error instanceof Error &&
        /^(Invalid Vercel|Latest required|Sensitive or unsafe|Source changed|Vercel dry)/.test(
          error.message,
        )
        ? error.message
        : "Source verification failed. No deployment created.",
    );
    process.exitCode = 1;
  }
}
