import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Created with explicit approval and independently verified through metadata GETs.
export const approvedNeonProject = "divine-dawn-11566468";
export const approvedNeonBranch = "br-bold-heart-b42fnp9k";
export const approvedNeonOrganization = "org-broad-lab-06866989";
export const approvedNeonEndpoint = "ep-ancient-unit-b45mjtvt";
export const approvedNeonHostname =
  "ep-ancient-unit-b45mjtvt.c-6.us-east-2.aws.neon.tech";
export const neonCliVersion = "8.11.1";
const prefix = `/projects/${approvedNeonProject}`;
const emptyContext = join(
  tmpdir(),
  `trustcore-neon-no-context-${randomUUID()}.json`,
);
export class NeonSetupError extends Error {}

export function validateNeonApiKey(value) {
  const key = typeof value === "string" ? value.trim() : "";
  // A local sanity check, not proof of authentication or a claim about every Neon token format.
  if (
    !/^[\x21-\x7E]{32,4096}$/.test(key) ||
    /^(?:bearer|postgres(?:ql)?|https?):/i.test(key) ||
    /^["']|["']$/.test(key) ||
    key.includes("...")
  )
    throw new NeonSetupError(
      "Neon credential input is incomplete or malformed. Enter the full API key, not a database password, project ID, Bearer header or shortened token; alternatively choose LOGIN.",
    );
  return key;
}

export function neonStage(path) {
  if (path.includes("reset_password")) return "development role rotation";
  if (path.includes("/operations/")) return "rotation completion";
  if (path.includes("connection_uri")) return "direct connection metadata";
  if (path.endsWith("/roles")) return "role metadata";
  if (path.endsWith("/databases")) return "database metadata";
  if (path.endsWith("/endpoints")) return "endpoint metadata";
  if (path.includes("/branches/")) return "branch metadata";
  return "project metadata";
}

export function assertNeonRequest(path, method) {
  const pathname = path.split("?")[0];
  const branch = `${prefix}/branches/${approvedNeonBranch}`;
  const permittedGet =
    [
      prefix,
      branch,
      `${prefix}/endpoints`,
      `${branch}/roles`,
      `${branch}/databases`,
      `${prefix}/connection_uri`,
    ].includes(pathname) ||
    new RegExp(`^${prefix}/operations/[a-f0-9-]{36}$`).test(pathname);
  const permittedPost =
    pathname.startsWith(`${branch}/roles/`) &&
    /^\/[^/]+\/reset_password$/.test(pathname.slice(`${branch}/roles`.length));
  if (
    (method !== "GET" || !permittedGet) &&
    (method !== "POST" || !permittedPost)
  )
    throw new NeonSetupError(
      "Refused a Neon request outside the approved development routes.",
    );
  if (pathname === `${prefix}/connection_uri`) {
    const query = new URLSearchParams(path.split("?")[1]);
    if (
      query.get("branch_id") !== approvedNeonBranch ||
      query.get("pooled") !== "false" ||
      query.get("database_name") !== "neondb"
    )
      throw new NeonSetupError(
        "Refused unscoped or pooled connection metadata.",
      );
  }
}

export function apiFailure(path, status, detail) {
  const hints = {
    401: "authentication rejected; use LOGIN or a complete valid API key",
    403: "identity lacks permission for the verified development target",
    404: `expected development target ${approvedNeonProject} is unavailable to this identity; this does not mean CLI login failed. Stop and confirm project ownership or approve a fresh isolated development project; do not substitute another visible project`,
    429: "rate limited; retry the read later",
  };
  const error = new NeonSetupError(
    `Neon ${neonStage(path)}: ${status ? `HTTP ${status}${detail ? `; ${detail}` : ""}` : detail || "network/CLI failure"}${hints[status] ? `; ${hints[status]}` : ""}. Private response suppressed. No automatic mutation retry.`,
  );
  error.status = status;
  return error;
}

export async function requestNeon(key, path, method = "GET", fetcher = fetch) {
  assertNeonRequest(path, method);
  const credential = validateNeonApiKey(key);
  let response;
  try {
    response = await fetcher(`https://console.neon.tech/api/v2${path}`, {
      method,
      headers: { Authorization: `Bearer ${credential}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    throw apiFailure(
      path,
      undefined,
      ["AbortError", "TimeoutError"].includes(error?.name)
        ? "network timeout"
        : "network/TLS failure",
    );
  }
  if (!response.ok) throw apiFailure(path, response.status);
  try {
    return await response.json();
  } catch {
    throw apiFailure(path, response.status, "invalid JSON");
  }
}

function execute(args, login = false) {
  const env = { ...process.env };
  delete env.NEON_API_KEY;
  delete env.NEON_API_HOST;
  delete env.NEON_OAUTH_HOST;
  delete env.NEON_PROJECT_ID;
  delete env.NEON_BRANCH_ID;
  // The official CLI manages its own authentication. We never open credential files.
  const command = login ? "/usr/bin/script" : "npm";
  const npm = [
    "exec",
    "--yes",
    "--ignore-scripts",
    `--package=neon@${neonCliVersion}`,
    "--",
    "neon",
    ...args,
    "--no-analytics",
    "--no-color",
    "--context-file",
    emptyContext,
  ];
  const argv = login ? ["-q", "/dev/null", "npm", ...npm] : npm;
  const result = spawnSync(command, argv, {
    env,
    encoding: "utf8",
    timeout: login ? 300000 : 60000,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function parseCliResponse(path, result) {
  // --include emits the real HTTP status; neither headers nor raw bodies are logged.
  const output = result.stdout;
  const statusLine = /^HTTP(?:\/[\d.]+)?\s+(\d{3})\b[^\r\n]*\r?\n/m.exec(
    output,
  );
  const observed = statusLine
    ? Number(statusLine[1])
    : Number(
        /(?:HTTP\s+|status(?:Code)?[\s":=]+)([45]\d\d)\b/i.exec(
          result.stderr,
        )?.[1],
      ) || undefined;
  if (result.status !== 0 || (observed && (observed < 200 || observed >= 300)))
    throw apiFailure(
      path,
      observed,
      observed
        ? "CLI request failed"
        : "CLI request failed (HTTP status unavailable)",
    );
  if (!statusLine)
    throw apiFailure(path, undefined, "CLI response missing HTTP status");
  const remaining = output.slice(statusLine.index + statusLine[0].length);
  const separator = /\r?\n\r?\n/.exec(remaining);
  // A headerless response has just one blank line after its status.
  const body = remaining.startsWith("\n")
    ? remaining.slice(1)
    : remaining.startsWith("\r\n")
      ? remaining.slice(2)
      : separator
        ? remaining.slice(separator.index + separator[0].length)
        : "";
  try {
    return JSON.parse(body);
  } catch {
    throw apiFailure(path, observed, "invalid CLI JSON");
  }
}

export async function authenticateNeon({
  prompt,
  log,
  run = execute,
  environmentKey = process.env.NEON_API_KEY,
  fetcher = fetch,
}) {
  const apiAdapter = (key) => ({
    request: (path, method = "GET") => requestNeon(key, path, method, fetcher),
  });
  if (environmentKey) {
    try {
      const auth = apiAdapter(validateNeonApiKey(environmentKey));
      await auth.request(prefix);
      log("PASS Neon authentication from Terminal environment (value hidden)");
      return auth;
    } catch (error) {
      if (
        !(error instanceof NeonSetupError) ||
        (error.status && ![401, 403].includes(error.status))
      )
        throw error;
      log(`FAIL ${error.message}`);
    }
  }
  const cliAdapter = {
    request: async (path, method = "GET") => {
      assertNeonRequest(path, method);
      return parseCliResponse(
        path,
        await run([
          "api",
          path,
          "--method",
          method,
          "--include",
          "--output",
          "json",
        ]),
      );
    },
  };
  const signedIn = async () => {
    const result = await run(["me", "--output", "json"]);
    if (result.status !== 0) return false;
    try {
      const user = JSON.parse(result.stdout);
      return (
        user.authenticated !== false &&
        !!(user.id || user.login || user.email || user.user?.id)
      );
    } catch {
      return false;
    }
  };
  if (await signedIn()) {
    await cliAdapter.request(prefix);
    log(
      "PASS Existing Neon CLI session authorized for the development project",
    );
    return cliAdapter;
  }
  log(
    "Neon authentication is required. LOGIN opens the official browser authorization once; no Console/Dashboard setup. A valid API key is the alternative. Browser authorization cannot be bypassed.",
  );
  for (let attempt = 0; attempt < 3; attempt++) {
    const mode = await prompt(
      "Type LOGIN for official CLI sign-in, or KEY to enter a complete API key privately (Return cancels): ",
    );
    if (mode === "KEY") {
      let auth;
      try {
        auth = apiAdapter(
          validateNeonApiKey(await prompt("Full Neon API key (hidden): ")),
        );
      } catch (error) {
        if (!(error instanceof NeonSetupError)) throw error;
        log(`FAIL ${error.message}`);
        continue;
      }
      try {
        await auth.request(prefix);
      } catch (error) {
        if (
          !(error instanceof NeonSetupError) ||
          ![401, 403].includes(error.status)
        )
          throw error;
        log(`FAIL ${error.message}`);
        continue;
      }
      log("PASS Neon API key authenticated for the development project");
      return auth;
    }
    if (mode === "LOGIN") {
      log(
        "ACTION Approve the browser window opened by Neon CLI. Authentication output is captured; its session is managed by the OS keyring.",
      );
      await run(["login", "--keyring"], true);
      if (!(await signedIn()))
        throw new NeonSetupError(
          "Neon CLI sign-in was not completed. One official browser authorization or an existing valid API key is required; credentials cannot be fabricated. Vercel-managed Neon accounts may require an API key.",
        );
      await cliAdapter.request(prefix);
      log("PASS Neon CLI sign-in and development project access");
      return cliAdapter;
    }
    throw new NeonSetupError(
      "Neon authentication cancelled; no credential rotation or environment writes performed.",
    );
  }
  throw new NeonSetupError(
    "No complete Neon credential supplied. Rerun and choose LOGIN or enter a full API key privately.",
  );
}
