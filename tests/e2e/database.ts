import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { approvedTestDatabase } from "../development-database-target";
const run = promisify(execFile);
export const url = process.env.BOOKING_E2E_DATABASE_URL;
export const verified =
  process.env.BOOKING_E2E_DATABASE_VERIFIED === "YES" &&
  process.env.BOOKING_MVP_ENABLED === "true" &&
  approvedTestDatabase(url);
export async function sql(query: string) {
  if (!verified || !url)
    throw new Error("Verified booking test target required");
  const target = new URL(url);
  const result = await run(
    "psql",
    ["-X", "-w", "-At", "-v", "ON_ERROR_STOP=1", "-c", query],
    {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        PGHOST: target.hostname,
        PGPORT: target.port || "5432",
        PGUSER: decodeURIComponent(target.username),
        PGPASSWORD: decodeURIComponent(target.password),
        PGDATABASE: target.pathname.slice(1),
        PGSSLMODE: target.hostname === "127.0.0.1" ? "disable" : "verify-full",
        PGCONNECT_TIMEOUT: "30",
        PGSERVICEFILE: "/dev/null",
        PGPASSFILE: "/dev/null",
        PGSSLROOTCERT: "system",
      },
      timeout: 60000,
    },
  );
  return result.stdout.trim();
}
