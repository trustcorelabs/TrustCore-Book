import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { parse } from "dotenv";

// Uses only the existing setup:local cluster. Never creates or migrates a database.
const root = process.cwd();
function fail(message) {
  throw new Error(message);
}
function run(command, args, env, capture = false) {
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) fail(`${command} failed; no further steps run.`);
  return result.stdout?.trim();
}
try {
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  if (!raw.startsWith("# Managed by pnpm setup:local\n"))
    fail("Requires the managed local configuration.");
  const local = parse(raw);
  const state = JSON.parse(
    readFileSync(resolve(root, ".local/database.json"), "utf8"),
  );
  const target = new URL(local.DATABASE_URL);
  if (
    local.DATABASE_URL !== local.DIRECT_URL ||
    target.protocol !== "postgresql:" ||
    target.hostname !== "127.0.0.1" ||
    target.port !== "55432" ||
    target.pathname !== "/trustcore_book_local" ||
    target.username !== "trustcore_local" ||
    decodeURIComponent(target.password) !== state.password
  )
    fail("Local target identity mismatch.");
  if (
    local.BOOKING_MVP_ENABLED !== "false" ||
    local.A2_MEMBERSHIP_ENABLED !== "false"
  )
    fail("Keep persistent feature flags false.");
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    CI: "1",
    NEXT_DIST_DIR: ".next-booking-test",
    DOTENV_CONFIG_PATH: "/dev/null",
  };
  const pg = {
    ...env,
    PGHOST: target.hostname,
    PGPORT: target.port,
    PGUSER: target.username,
    PGPASSWORD: decodeURIComponent(target.password),
    PGDATABASE: target.pathname.slice(1),
    PGSSLMODE: "disable",
    PGCONNECT_TIMEOUT: "5",
    PGOPTIONS: "-c default_transaction_read_only=on",
    PGSERVICEFILE: "/dev/null",
  };
  const sql = (query) =>
    run(
      "psql",
      ["-X", "-w", "-At", "-v", "ON_ERROR_STOP=1", "-c", query],
      pg,
      true,
    );
  if (sql("SHOW data_directory") !== resolve(root, ".local/postgres"))
    fail("Cluster directory mismatch.");
  const expected = readdirSync("prisma/migrations")
    .filter((name) => /^\d/.test(name))
    .sort();
  const applied = sql(
    'SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name',
  ).split("\n");
  if (
    JSON.stringify(applied) !== JSON.stringify(expected) ||
    sql(
      'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL',
    ) !== "0"
  )
    fail(
      "Pending or failed migrations. Explicit authorization is required; this command never applies them.",
    );
  if (
    sql(
      "SELECT count(*) FROM pg_constraint WHERE conname='appointment_staff_no_overlap' AND contype='x'",
    ) !== "1" ||
    sql(`SELECT to_regclass('public."BookingRequest"') IS NOT NULL`) !== "t"
  )
    fail("Required booking schema missing.");
  console.log(
    `Verified managed local cluster, ${applied.length} migrations, booking table and exclusion constraint.`,
  );
  const testEnv = {
    ...env,
    LOCAL_TEST_DATABASE_VERIFIED: "YES",
    LOCAL_TEST_DATABASE_URL: local.DATABASE_URL,
    TEST_DATABASE_URL: local.DATABASE_URL,
    A1_TEST_DATABASE_URL: local.DATABASE_URL,
    A1_TEST_DATABASE_VERIFIED: "YES",
    A2_TEST_DATABASE_URL: local.DATABASE_URL,
    A2_TEST_DATABASE_VERIFIED: "YES",
    BOOKING_TEST_DATABASE_URL: local.DATABASE_URL,
    BOOKING_TEST_DATABASE_VERIFIED: "YES",
    DATABASE_URL: local.DATABASE_URL,
    DIRECT_URL: local.DIRECT_URL,
    NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
    NEXTAUTH_URL: "http://127.0.0.1:3100",
    A2_MEMBERSHIP_ENABLED: "false",
    BOOKING_MVP_ENABLED: "false",
  };
  run(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "tests/database.test.ts",
      "tests/account-database.integration.test.ts",
      "tests/membership-database.integration.test.ts",
      "tests/booking-database.integration.test.ts",
      "--no-file-parallelism",
      "--maxWorkers=1",
    ],
    testEnv,
  );
  // Booking enabled only for this isolated browser-test server after schema/integration gates pass.
  run("pnpm", ["exec", "playwright", "test", "--workers=1", "--retries=0"], {
    ...testEnv,
    BOOKING_E2E_DATABASE_URL: local.DATABASE_URL,
    BOOKING_E2E_DATABASE_VERIFIED: "YES",
    BOOKING_MVP_ENABLED: "true",
    PLAYWRIGHT_CHROME_CHANNEL: "chrome",
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
