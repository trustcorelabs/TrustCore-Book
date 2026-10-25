import { randomBytes } from "node:crypto";
import {
  readFileSync,
  mkdirSync,
  copyFileSync,
  symlinkSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  expectedPreview,
  assertPreviewIdentity,
} from "./verify-preview-target.mjs";
import {
  previewProject,
  previewBranch,
  verifyPreviewMetadata,
  verifyPreviewNeon,
} from "./verify-preview-neon.mjs";
import {
  authenticateNeon,
  validateNeonApiKey,
  requestNeon,
  NeonSetupError,
  approvedNeonOrganization,
  approvedNeonEndpoint,
  approvedNeonHostname,
} from "./neon-auth.mjs";
import { verifySourceManifest } from "./preview-source-manifest.mjs";

const branch = `/branches/${previewBranch}`;
const scope = [
  "--project",
  expectedPreview.projectId,
  "--scope",
  expectedPreview.scope,
];
const fixed = {
  BOOKING_MVP_ENABLED: "false",
  A2_MEMBERSHIP_ENABLED: "false",
  ACCOUNT_EMAIL_PROVIDER: "disabled",
  LOCAL_OUTBOX_ENABLED: "NO",
  LOCAL_OUTBOX_TARGET_APPROVED: "NO",
};
const removeKeys = ["NEXTAUTH_URL", "NEXTAUTH_URL_INTERNAL", "DIRECT_URL"];
const writeKeys = ["DATABASE_URL", "NEXTAUTH_SECRET", ...Object.keys(fixed)];
class SetupFailure extends Error {}
const fail = (message) => {
  throw new SetupFailure(message);
};

export function strictTLS(value) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    if (url.hostname.includes("-pooler.")) throw new Error();
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  } catch {
    return fail("Connection metadata is invalid; no values displayed.");
  }
}

export function previewPlan(envs) {
  if (!Array.isArray(envs))
    return fail("Environment metadata missing; no writes allowed.");
  const plan = [];
  for (const key of [...writeKeys, ...removeKeys]) {
    const entries = envs.filter(
      (item) =>
        item.key === key &&
        Array.isArray(item.target) &&
        item.target.includes("preview"),
    );
    if (
      entries.some(
        (item) =>
          item.target.length !== 1 ||
          item.gitBranch ||
          item.customEnvironmentIds?.length,
      ) ||
      entries.length > 1
    )
      return fail(
        `Preview variable ${key} is shared, branch-specific or ambiguous. Refusing to change it.`,
      );
    if (removeKeys.includes(key)) {
      if (entries.length) plan.push({ key, action: "remove" });
    } else plan.push({ key, action: entries.length ? "replace" : "add" });
  }
  if (
    envs.some(
      (item) =>
        ["NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_URL"].includes(item.key) &&
        item.target?.includes("preview"),
    )
  )
    return fail(
      "User-defined platform variables found in Preview. Refusing unsafe overrides.",
    );
  return plan;
}

function validateProject(project, link) {
  assertPreviewIdentity(link, project);
  if (
    project.framework !== "nextjs" ||
    project.outputDirectory != null ||
    project.rootDirectory ||
    project.buildCommand !== "pnpm build" ||
    project.installCommand !== "pnpm install --frozen-lockfile" ||
    project.autoExposeSystemEnvs !== true
  )
    fail(
      "Vercel build/platform settings do not match the verified Next.js configuration.",
    );
}

export async function runSetup(io) {
  let apiKey, password, databaseURL;
  try {
    let project = JSON.parse(
      await io.cli([
        "api",
        `/v9/projects/${expectedPreview.projectId}`,
        "--scope",
        expectedPreview.scope,
        "--non-interactive",
      ]),
    );
    validateProject(project, io.link());
    previewPlan(project.env);
    io.log("PASS Vercel project/team, framework and Preview variable scope");
    const authenticated = io.authenticate ? await io.authenticate() : null;
    if (!authenticated)
      apiKey = validateNeonApiKey(
        await io.prompt("Full Neon API key (hidden; never saved): "),
      );
    const request = authenticated
      ? (path, method = "GET") =>
          authenticated.request(`/projects/${previewProject}${path}`, method)
      : (path, method = "GET") => io.neon(path, apiKey, method);
    const [p, b, endpoints, databases, roles] = await Promise.all([
      request(""),
      request(branch),
      request("/endpoints"),
      request(`${branch}/databases`),
      request(`${branch}/roles`),
    ]);
    const db = databases.databases?.find(
      (item) => item.name === "neondb" && item.branch_id === previewBranch,
    );
    const role = roles.roles?.find(
      (item) =>
        item.name === db?.owner_name && item.branch_id === previewBranch,
    );
    const candidates = endpoints.endpoints?.filter(
      (item) =>
        item.project_id === previewProject &&
        item.branch_id === previewBranch &&
        item.type === "read_write" &&
        item.disabled !== true,
    );
    if (
      p.project?.id !== previewProject ||
      p.project.name !== "trustcore-book-dev" ||
      p.project.org_id !== approvedNeonOrganization ||
      b.branch?.id !== previewBranch ||
      b.branch.project_id !== previewProject ||
      !!b.branch.parent_id ||
      !db ||
      !role ||
      role.protected === true ||
      role.name === "neon_superuser" ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(role.name) ||
      (role.authentication_method &&
        role.authentication_method !== "password") ||
      candidates?.length !== 1 ||
      candidates[0].id !== approvedNeonEndpoint ||
      candidates[0].host !== approvedNeonHostname
    )
      fail(
        "Development project, branch, database, role or endpoint ownership verification failed.",
      );
    const endpoint = candidates[0];
    if (!/^ep-[a-z0-9-]+$/.test(endpoint.id))
      fail("Development endpoint identifier is invalid.");
    io.log(
      `PASS Neon development identity: ${previewProject} / ${previewBranch}`,
    );
    let manifest = JSON.parse(
      await io.cli([
        "deploy",
        "--dry",
        "--json",
        "--environment",
        "preview",
        ...scope,
        "--non-interactive",
      ]),
    );
    const source = io.source(manifest);
    io.log("PASS Current local source and upload exclusions");
    await io.checks(manifest);
    io.log(
      "Rotation affects only the verified development database owner role and drops its existing connections. It never targets the original project. No automatic retry or rollback.",
    );
    const choice = await io.prompt(
      "Type ROTATE DEV to rotate now, or FRESH if you already rotated outside this helper (anything else cancels): ",
    );
    if (choice === "ROTATE DEV") {
      const reset = await request(
        `${branch}/roles/${encodeURIComponent(role.name)}/reset_password`,
        "POST",
      );
      if (
        reset.role?.name !== role.name ||
        reset.role?.branch_id !== previewBranch ||
        !reset.role.password ||
        !Array.isArray(reset.operations)
      )
        fail(
          "Rotation response could not be verified; no Vercel writes attempted. Do not retry rotation automatically.",
        );
      password = reset.role.password;
      for (const operation of reset.operations) {
        if (
          operation.project_id !== previewProject ||
          (operation.branch_id && operation.branch_id !== previewBranch) ||
          !/^[a-f0-9-]{36}$/.test(operation.id)
        )
          fail(
            "Rotation operation identity mismatch; no Vercel writes attempted.",
          );
        let finished = false;
        for (let attempt = 0; attempt < 90; attempt++) {
          const state = (await request(`/operations/${operation.id}`))
            .operation;
          if (
            state?.id !== operation.id ||
            state.project_id !== previewProject ||
            (state.branch_id && state.branch_id !== previewBranch)
          )
            fail("Rotation operation response could not be verified.");
          if (["finished", "skipped"].includes(state.status)) {
            finished = true;
            break;
          }
          if (!["running", "scheduling"].includes(state.status))
            fail(
              "Development rotation operation failed. No Vercel writes attempted.",
            );
          if (attempt % 5 === 0)
            io.log("WAIT Development credential rotation operation");
          await io.wait(2000);
        }
        if (!finished)
          fail(
            "Development rotation did not finish in time; no Vercel writes attempted.",
          );
      }
      io.log("PASS Development role password rotated; operations completed");
    } else if (choice === "FRESH") {
      password = await io.prompt(
        "Fresh development password, already rotated outside this helper (hidden): ",
      );
      if (!password || /[\r\n]/.test(password))
        fail("Fresh development credentials required.");
    } else {
      io.log("SKIP Credential rotation and Preview writes cancelled");
      return;
    }
    const query = new URLSearchParams({
      branch_id: previewBranch,
      endpoint_id: endpoint.id,
      database_name: "neondb",
      role_name: role.name,
      pooled: "false",
    });
    const connection = await request(`/connection_uri?${query}`);
    databaseURL = strictTLS(connection.uri);
    const url = new URL(databaseURL);
    if (
      url.hostname !== endpoint.host ||
      decodeURIComponent(url.username) !== role.name ||
      !url.password ||
      decodeURIComponent(url.password) !== password
    )
      fail(
        "Fresh connection credentials do not match the verified development role; no Vercel writes attempted.",
      );
    if (authenticated) await verifyPreviewMetadata(databaseURL, request);
    else await io.verify(databaseURL, apiKey);
    io.log(
      "PASS Fresh direct connection metadata, TLS and independent Neon ownership checks (no SQL connection)",
    );
    project = JSON.parse(
      await io.cli([
        "api",
        `/v9/projects/${expectedPreview.projectId}`,
        "--scope",
        expectedPreview.scope,
        "--non-interactive",
      ]),
    );
    validateProject(project, io.link());
    const plan = previewPlan(project.env);
    io.log(
      "Preview-only plan: " +
        plan.map((item) => `${item.action} ${item.key}`).join(", "),
    );
    io.log(
      "A fresh Preview auth secret will replace any Preview-only secret and invalidate Preview sessions. Production variables are never updated. Flags stay false; email/outbox are disabled.",
    );
    if (
      (await io.prompt(
        "Type WRITE PREVIEW to apply this plan (anything else cancels): ",
      )) !== "WRITE PREVIEW"
    ) {
      io.log(
        "SKIP Preview variables unchanged; any confirmed Neon rotation remains effective",
      );
      return;
    }
    const values = {
      ...fixed,
      DATABASE_URL: databaseURL,
      NEXTAUTH_SECRET: randomBytes(48).toString("base64url"),
    };
    for (const item of plan) {
      // Revalidate scope immediately before each CLI write. Never update shared Production/Preview records.
      const current = JSON.parse(
        await io.cli([
          "api",
          `/v9/projects/${expectedPreview.projectId}`,
          "--scope",
          expectedPreview.scope,
          "--non-interactive",
        ]),
      );
      validateProject(current, io.link());
      const live = previewPlan(current.env).find(
        (candidate) => candidate.key === item.key,
      );
      if (live?.action !== item.action)
        fail(
          "Preview environment scope changed during setup. Stopped before the next write.",
        );
      const args = [
        "env",
        item.action === "replace" ? "add" : item.action,
        item.key,
        "--environment",
        "preview",
        ...scope,
        "--yes",
        "--non-interactive",
      ];
      if (item.action === "replace") {
        // `env update` may update every environment of a shared record. Never use it.
        await io.cli([
          "env",
          "remove",
          item.key,
          "--environment",
          "preview",
          ...scope,
          "--yes",
          "--non-interactive",
        ]);
      }
      if (item.action !== "remove") args.push("--sensitive");
      await io.cli(
        args,
        item.action === "remove" ? undefined : values[item.key] + "\n",
      );
      io.log(`PASS Preview ${item.key} ${item.action}`);
    }
    apiKey = password = databaseURL = undefined;
    for (const key of Object.keys(values)) values[key] = "";
    io.log(
      "PASS Preview configuration applied; schema and integration readiness remain unverified; features stay disabled",
    );
    if (
      (await io.prompt(
        "Type DEPLOY PREVIEW to upload current source now, or press Return to finish without deployment: ",
      )) !== "DEPLOY PREVIEW"
    ) {
      io.log(
        "SKIP Deployment not requested. Preview configuration is ready for a later confirmed deployment.",
      );
      return;
    }
    manifest = JSON.parse(
      await io.cli([
        "deploy",
        "--dry",
        "--json",
        "--environment",
        "preview",
        ...scope,
        "--non-interactive",
      ]),
    );
    const latest = io.source(manifest);
    if (latest.sha256 !== source.sha256)
      fail("Source changed since checks. Rerun the helper before deploying.");
    const result = await io.cli(
      [
        "deploy",
        ".",
        "--environment",
        "preview",
        "--force",
        ...scope,
        "--meta",
        `localSourceSha256=${latest.sha256}`,
        "--non-interactive",
      ],
      undefined,
      600000,
    );
    const deployed = result.trim();
    if (!/^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(deployed))
      fail(
        "Deployment response not recognized. Inspect the verified project before retrying.",
      );
    const inspection = JSON.parse(
      await io.cli([
        "api",
        `/v13/deployments/${new URL(deployed).hostname}`,
        "--scope",
        expectedPreview.scope,
        "--non-interactive",
      ]),
    );
    const finalProject = JSON.parse(
      await io.cli([
        "api",
        `/v9/projects/${expectedPreview.projectId}`,
        "--scope",
        expectedPreview.scope,
        "--non-interactive",
      ]),
    );
    validateProject(finalProject, io.link());
    const owner =
      inspection.ownerId ?? inspection.team?.id ?? inspection.teamId;
    if (
      inspection.projectId !== expectedPreview.projectId ||
      (owner !== undefined && owner !== expectedPreview.orgId) ||
      inspection.target != null ||
      inspection.readyState !== "READY" ||
      inspection.meta?.localSourceSha256 !== latest.sha256
    )
      fail(
        "Deployment identity, target, readiness or source receipt failed verification.",
      );
    io.log("PASS Preview deployment identity, readiness and source receipt");
    for (const path of [
      "/api/auth/providers",
      "/api/auth/session",
      "/api/dev/outbox",
    ]) {
      const response = await io.cli([
        "curl",
        path,
        "--deployment",
        deployed,
        "--scope",
        expectedPreview.scope,
        "--",
        "--silent",
        "--write-out",
        "\n%{http_code}",
      ]);
      const split = response.trim().lastIndexOf("\n");
      const body = response.slice(0, split),
        status = response.slice(split + 1).trim();
      if (status !== (path.endsWith("outbox") ? "404" : "200"))
        fail(`Runtime check ${path} failed; response contents suppressed.`);
      if (path.endsWith("providers")) {
        const provider = JSON.parse(body).credentials;
        if (!provider || new URL(provider.signinUrl).origin !== deployed)
          fail("Preview auth provider origin check failed.");
      }
      if (path.endsWith("session") && JSON.stringify(JSON.parse(body)) !== "{}")
        fail("Unexpected authenticated session in anonymous smoke check.");
      io.log(`PASS Preview ${path} HTTP ${status}`);
    }
    io.log(`PASS Preview URL: ${deployed}`);
  } finally {
    apiKey = password = databaseURL = undefined;
  }
}

// No child output is streamed: CLI failures may contain secret input or connection details.
function cli(
  args,
  input,
  timeout = 120000,
  cwd = process.cwd(),
  env = process.env,
  command = "vercel",
) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    input,
    encoding: "utf8",
    timeout,
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0)
    fail(
      `${command === "vercel" ? "Vercel command" : "Local check"} failed; private output suppressed. Stop and inspect the current setup state before retrying.`,
    );
  return result.stdout;
}

export function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode)
    fail("Run this helper in interactive Mac Terminal, not chat or a pipe.");
  process.stdout.write(label);
  return new Promise((resolvePrompt, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    function finish(error) {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolvePrompt(value);
    }
    function onData(data) {
      const chunk = data.toString("utf8").replace(/\x1b\[(?:200|201)~/g, "");
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003" || char === "\u0004")
          return finish(new Error("Setup cancelled."));
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " " && char !== "\u001b") value += char;
        if (value.length > 32768)
          return finish(new Error("Private input exceeded allowed length."));
      }
    }
    process.stdin.on("data", onData);
  });
}

export function verifyBuildContract(pkg, config) {
  const expected = {
    build: "prisma generate && next build --webpack",
    postinstall: "prisma generate",
    typecheck: "next typegen && tsc --noEmit",
    lint: "eslint .",
    test: "vitest run",
  };
  if (
    Object.entries(expected).some(
      ([key, value]) => pkg.scripts?.[key] !== value,
    ) ||
    [
      "preinstall",
      "install",
      "prepare",
      "prebuild",
      "postbuild",
      "pretypecheck",
      "posttypecheck",
      "pretest",
      "posttest",
      "prelint",
      "postlint",
    ].some((key) => pkg.scripts?.[key]) ||
    config.framework !== "nextjs" ||
    config.buildCommand !== "pnpm build" ||
    config.installCommand !== "pnpm install --frozen-lockfile" ||
    config.outputDirectory != null ||
    config.env ||
    config.build ||
    config.builds
  )
    fail(
      "Build hooks/configuration changed from the audited secret-free contract. No checks or deployment allowed.",
    );
}

export async function secretFreeChecks(manifest) {
  verifyBuildContract(
    JSON.parse(readFileSync("package.json", "utf8")),
    JSON.parse(readFileSync("vercel.json", "utf8")),
  );
  const folder = mkdtempSync(join(tmpdir(), "trustcore-preview-check-"));
  const root = process.cwd();
  try {
    verifySourceManifest(manifest);
    for (const file of manifest.files.filter((item) => item.sha)) {
      const dest = join(folder, file.path);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(file.path, dest);
    }
    symlinkSync(
      join(root, "node_modules"),
      join(folder, "node_modules"),
      "dir",
    );
    // Explicit allowlist: no credentials, test targets, platform/OIDC or .env settings inherited.
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      TMPDIR: process.env.TMPDIR,
      CI: "1",
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/preview_check",
      DIRECT_URL: "",
      NEXTAUTH_URL: "https://preview-check.example.test",
      NEXTAUTH_SECRET: randomBytes(48).toString("hex"),
      BOOKING_MVP_ENABLED: "false",
      A2_MEMBERSHIP_ENABLED: "false",
      LOCAL_OUTBOX_ENABLED: "NO",
      DOTENV_CONFIG_PATH: "/dev/null",
    };
    for (const args of [["build"], ["typecheck"], ["lint"], ["test"]]) {
      console.log(`CHECK Isolated ${args[0]} (private output captured)`);
      cli(args, undefined, 600000, folder, env, "pnpm");
      console.log(`PASS Isolated ${args[0]}`);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  let phase = "setup";
  try {
    if (
      process.argv.length !== 2 ||
      !process.stdin.isTTY ||
      !process.stdout.isTTY ||
      process.execArgv.some((arg) => /inspect|debug/.test(arg)) ||
      /inspect|debug/.test(process.env.NODE_OPTIONS ?? "")
    )
      fail(
        "Use one plain interactive Terminal command; no secret arguments, debugger or pipe.",
      );
    await runSetup({
      cli: async (...args) => cli(...args),
      prompt: hiddenPrompt,
      log: (message) => {
        phase = message.startsWith("PASS") ? message.slice(5) : phase;
        console.log(message);
      },
      link: () => JSON.parse(readFileSync(".vercel/project.json", "utf8")),
      source: verifySourceManifest,
      checks: secretFreeChecks,
      wait: (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms)),
      verify: (value, key) => verifyPreviewNeon(value, key),
      authenticate: () =>
        authenticateNeon({
          prompt: hiddenPrompt,
          log: (message) => console.log(message),
        }),
      neon: (path, key, method) =>
        requestNeon(key, `/projects/${previewProject}${path}`, method),
    });
  } catch (error) {
    console.error(
      `FAIL ${error instanceof SetupFailure || error instanceof NeonSetupError ? error.message : "Private error details suppressed."} Last completed: ${phase}. No automatic retry; already-confirmed writes remain in effect.`,
    );
    process.exitCode = 1;
  } finally {
    if (process.stdin.isTTY && process.stdin.isRaw)
      process.stdin.setRawMode(false);
  }
}
