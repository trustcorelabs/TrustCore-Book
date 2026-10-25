import { pathToFileURL } from "node:url";
import {
  NeonSetupError,
  validateNeonApiKey,
  requestNeon,
  approvedNeonProject,
  approvedNeonBranch,
  approvedNeonOrganization,
  approvedNeonEndpoint,
  approvedNeonHostname,
} from "./neon-auth.mjs";

export const previewProject = approvedNeonProject;
export const previewBranch = approvedNeonBranch;

export function parsePreviewDatabase(value) {
  try {
    const url = new URL(value.trim());
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.username ||
      !url.password ||
      url.pathname !== "/neondb" ||
      (url.port && url.port !== "5432") ||
      url.hash ||
      !/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+){1,3}\.aws\.neon\.tech$/.test(
        url.hostname,
      ) ||
      url.searchParams.get("sslmode") !== "verify-full" ||
      [...url.searchParams.keys()].some(
        (key) => !["sslmode", "channel_binding"].includes(key),
      ) ||
      [...url.searchParams.keys()].some(
        (key) => url.searchParams.getAll(key).length !== 1,
      )
    )
      return null;
    return {
      directHost: url.hostname.replace(/-pooler(?=\.)/, ""),
      database: "neondb",
    };
  } catch {
    return null;
  }
}

// Metadata GETs only. Never imports Prisma/pg, reads .env, or opens a database connection.
export async function verifyPreviewNeon(value, apiKey, fetcher = fetch) {
  if (!parsePreviewDatabase(value))
    throw new Error(
      "Invalid Preview database input. Require a fresh Neon URL with sslmode=verify-full.",
    );
  const credential = validateNeonApiKey(apiKey);
  return verifyPreviewMetadata(value, (path) =>
    requestNeon(
      credential,
      `/projects/${previewProject}${path}`,
      "GET",
      fetcher,
    ),
  );
}

export async function verifyPreviewMetadata(value, request) {
  const target = parsePreviewDatabase(value);
  if (!target)
    throw new Error(
      "Invalid Preview database input. Require a fresh direct Neon URL with sslmode=verify-full.",
    );
  try {
    const [project, branch, endpoints, databases] = await Promise.all([
      request(""),
      request(`/branches/${previewBranch}`),
      request("/endpoints"),
      request(`/branches/${previewBranch}/databases`),
    ]);
    if (
      project?.project?.id !== previewProject ||
      project.project.name !== "trustcore-book-dev" ||
      project.project.org_id !== approvedNeonOrganization ||
      branch?.branch?.id !== previewBranch ||
      branch.branch.project_id !== previewProject ||
      !!branch.branch.parent_id ||
      target.directHost !== approvedNeonHostname ||
      !Array.isArray(endpoints?.endpoints) ||
      !endpoints.endpoints.some(
        (endpoint) =>
          endpoint.id === approvedNeonEndpoint &&
          endpoint.host === target.directHost &&
          endpoint.project_id === previewProject &&
          endpoint.branch_id === previewBranch &&
          endpoint.type === "read_write" &&
          endpoint.disabled !== true,
      ) ||
      !Array.isArray(databases?.databases) ||
      !databases.databases.some(
        (database) =>
          database.name === target.database &&
          database.branch_id === previewBranch,
      )
    )
      throw new Error();
    return {
      projectId: previewProject,
      branchId: previewBranch,
      hostname: target.directHost,
      database: target.database,
    };
  } catch (error) {
    if (error instanceof NeonSetupError) throw error;
    throw new Error(
      "Preview Neon identity could not be verified. No database connection or environment change attempted.",
    );
  }
}

async function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode)
    throw new Error(
      "Run interactively in Terminal; do not supply secrets as arguments.",
    );
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function finish(error) {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }
    function onData(chunk) {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003")
          return finish(new Error("Verification cancelled."));
        if (char === "\u007f") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    }
    process.stdin.on("data", onData);
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const value = await hiddenPrompt("Fresh Preview Neon URL (hidden): ");
    const apiKey = await hiddenPrompt("Neon metadata API key (hidden): ");
    const result = await verifyPreviewNeon(value, apiKey);
    console.log(
      `Verified endpoint binding to ${result.projectId} / ${result.branchId}. No database connection made.`,
    );
    console.log(
      `Verified hostname: ${result.hostname}; database: ${result.database}. Enter only this verified URL in the subsequent sensitive Vercel prompt.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Preview verification failed.",
    );
    process.exitCode = 1;
  }
}
