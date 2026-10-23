import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const projectId = "fragrant-hat-50630079";
const branchId = "br-dark-brook-b4vdolwu";
const migrationNames = [
  "20261018000000_initial",
  "20261018010000_phase_a1_identity",
  "20261019010000_phase_a2_invitations",
  "20261019020000_phase_a2_final_owner_guard",
  "20261019030000_booking_idempotency",
];

export function parseDevelopmentUrl(value) {
  try {
    const url = new URL(value.trim());
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.username ||
      !url.password ||
      !/^ep-[a-z0-9-]+(?:\.[a-z0-9-]+){1,3}\.aws\.neon\.tech$/.test(
        url.hostname,
      ) ||
      url.hostname.includes("-pooler.") ||
      url.pathname !== "/neondb" ||
      (url.port && url.port !== "5432") ||
      !!url.hash ||
      url.searchParams.get("sslmode") !== "verify-full" ||
      [...url.searchParams.keys()].some(
        (key) => !["sslmode", "channel_binding"].includes(key),
      )
    )
      return null;
    return url;
  } catch {
    return null;
  }
}

export function matchesDevelopmentMetadata(url, project, branch, endpoints) {
  return (
    project?.id === projectId &&
    project.name === "trustcore-book-dev" &&
    branch?.id === branchId &&
    branch.name === "production" &&
    Array.isArray(endpoints) &&
    endpoints.some(
      (endpoint) =>
        endpoint.host === url.hostname &&
        endpoint.branch_id === branchId &&
        endpoint.project_id === projectId &&
        endpoint.type === "read_write" &&
        endpoint.disabled !== true,
    )
  );
}

async function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode)
    throw new Error("Run this check interactively in Mac Terminal.");
  process.stdout.write(label);
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = (error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const char of chunk.toString("utf8")) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003")
          return finish(new Error("Development target check cancelled."));
        if (char === "\u007f") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    process.stdin.on("data", onData);
  });
}

function query(url, statement) {
  const result = spawnSync(
    "psql",
    ["-X", "-w", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
    {
      env: {
        PATH: process.env.PATH ?? "",
        PGHOST: url.hostname,
        PGPORT: url.port || "5432",
        PGUSER: decodeURIComponent(url.username),
        PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: "neondb",
        PGSSLMODE: "verify-full",
        PGCONNECT_TIMEOUT: "5",
        PGOPTIONS: "-c default_transaction_read_only=on",
        PGSERVICEFILE: "/dev/null",
      },
      encoding: "utf8",
      timeout: 15000,
    },
  );
  if (result.status !== 0)
    throw new Error("Read-only database check failed. No writes attempted.");
  return result.stdout.trim();
}

export async function checkDevelopmentTarget(
  urlValue,
  apiKey,
  fetcher = fetch,
  sql = query,
) {
  const url = parseDevelopmentUrl(urlValue);
  if (!url || !apiKey.trim())
    throw new Error("Direct development URL or metadata key is invalid.");
  const base = `https://console.neon.tech/api/v2/projects/${projectId}`;
  const options = {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  };
  let projectResponse;
  let branchResponse;
  let endpointsResponse;
  try {
    [projectResponse, branchResponse, endpointsResponse] = await Promise.all([
      fetcher(base, options),
      fetcher(`${base}/branches/${branchId}`, options),
      fetcher(`${base}/endpoints`, options),
    ]);
  } catch {
    throw new Error("Neon project metadata could not be verified.");
  }
  if (!projectResponse.ok || !branchResponse.ok || !endpointsResponse.ok)
    throw new Error("Neon project metadata could not be verified.");
  let project;
  let branch;
  let endpoints;
  try {
    project = (await projectResponse.json()).project;
    branch = (await branchResponse.json()).branch;
    endpoints = (await endpointsResponse.json()).endpoints;
  } catch {
    throw new Error("Neon project metadata could not be verified.");
  }
  if (!matchesDevelopmentMetadata(url, project, branch, endpoints))
    throw new Error(
      "Endpoint does not belong to the expected development project and branch.",
    );

  if (sql(url, "SELECT current_database()") !== "neondb")
    throw new Error("Connected database identity mismatch.");
  const tableCount = Number(
    sql(
      url,
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    ),
  );
  const historyExists =
    sql(url, "SELECT to_regclass('public._prisma_migrations') IS NOT NULL") ===
    "t";
  if (!historyExists && tableCount === 0)
    return { state: "empty", endpoint: url.hostname };
  if (!historyExists || !Number.isInteger(tableCount) || tableCount < 1)
    throw new Error(
      "Unexpected schema state. Do not apply migrations automatically.",
    );
  const rows = sql(
    url,
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
  );
  const applied = rows ? rows.split("\n") : [];
  const failed = Number(
    sql(
      url,
      'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL',
    ),
  );
  if (
    failed !== 0 ||
    applied.join("|") !== migrationNames.slice(0, applied.length).join("|")
  )
    throw new Error("Migration history needs manual review before any writes.");
  if (applied.length === migrationNames.length) {
    const requiredTables = Number(
      sql(
        url,
        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('User','Business','BusinessMember','RateLimit','RefreshSession','AccountSecurityToken','BusinessInvitation','BookingRequest')",
      ),
    );
    const identityColumns = Number(
      sql(
        url,
        "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='User' AND column_name IN ('id','email','passwordHash','credentialVersion','emailVerificationRequired','emailVerifiedAt')",
      ),
    );
    if (requiredTables !== 8 || identityColumns !== 6)
      throw new Error(
        "Migration history is complete but required identity tables or columns are missing.",
      );
    const bookingGuards = Number(
      sql(
        url,
        `SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND (
          (conrelid = 'public."Appointment"'::regclass AND conname = 'appointment_staff_no_overlap' AND contype = 'x') OR
          (conrelid = 'public."BookingRequest"'::regclass AND conname IN ('BookingRequest_businessId_fkey','BookingRequest_businessId_appointmentId_fkey') AND contype = 'f')
        )`,
      ),
    );
    const idempotencyIndex = sql(
      url,
      `SELECT count(*) FROM pg_index WHERE indexrelid = to_regclass('public."BookingRequest_businessId_idempotencyKey_key"') AND indisunique AND indisvalid`,
    );
    if (bookingGuards !== 3 || idempotencyIndex !== "1")
      throw new Error(
        "Booking overlap, tenant or idempotency constraints are missing. Keep booking disabled.",
      );
  }
  return {
    state: applied.length === migrationNames.length ? "ready" : "partial",
    endpoint: url.hostname,
    applied,
    missing: migrationNames.filter((name) => !applied.includes(name)),
  };
}

async function main() {
  try {
    const url = await hiddenPrompt(
      "Fresh direct Neon development URL (hidden): ",
    );
    const key = await hiddenPrompt("Neon metadata API key (hidden): ");
    const result = await checkDevelopmentTarget(url, key);
    if (result.state === "empty")
      console.log(
        "Verified new development project and empty public schema. No migrations applied.",
      );
    else if (result.state === "ready")
      console.log(
        "Verified new development project and all five applied migrations.",
      );
    else
      console.log(
        `Verified development project; ${result.applied.length} of five migrations applied. Do not start registration yet.`,
      );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Read-only check failed.",
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
