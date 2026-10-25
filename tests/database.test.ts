import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { approvedTestDatabase } from "./development-database-target";
const run = promisify(execFile);
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;
const prefix = `test-${randomUUID()}`;
const a = `${prefix}-a`,
  b = `${prefix}-b`,
  staff = `${prefix}-staff`,
  service = `${prefix}-service`,
  customer = `${prefix}-customer`;
async function sql(query: string) {
  const connection = new URL(url!);

  return run("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", query], {
    env: {
      ...process.env,
      PGHOST: connection.hostname,
      PGPORT: connection.port || "5432",
      PGUSER: decodeURIComponent(connection.username),
      PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: connection.pathname.slice(1),
      // Match the application's bounded cold-Neon connection allowance.
      // Rehearsal measured connection establishment above the old 5s limit.
      PGCONNECT_TIMEOUT: "15",
      PGSSLMODE: connection.searchParams.get("sslmode") ?? "prefer",
    },
    timeout: 45000,
  });
}
function appointment(
  id: string,
  start: string,
  end: string,
  status = "CONFIRMED",
  customerId = customer,
) {
  return `INSERT INTO "Appointment" (id,"businessId","staffId","serviceId","customerId","startsAt","endsAt",status,price,currency) VALUES ('${prefix}-${id}','${a}','${staff}','${service}','${customerId}','${start}','${end}','${status}',100,'LKR');`;
}
suite("PostgreSQL tenant and booking constraints", () => {
  beforeAll(async () => {
    if (!url || !approvedTestDatabase(url))
      throw new Error(
        "TEST_DATABASE_URL must name an approved development test target.",
      );
    await sql(
      `INSERT INTO "Business" (id,name,slug,country,currency,timezone) VALUES ('${a}','Test A','${a}','LK','LKR','Asia/Colombo'),('${b}','Test B','${b}','LK','LKR','Asia/Colombo'); INSERT INTO "Staff" (id,"businessId",name) VALUES ('${staff}','${a}','Test staff'); INSERT INTO "Service" (id,"businessId",name,"durationMinutes",price) VALUES ('${service}','${a}','Test service',30,100); INSERT INTO "Customer" (id,"businessId",name) VALUES ('${customer}','${a}','Test customer'),('${prefix}-foreign','${b}','Foreign customer');`,
    );
  });
  afterAll(async () => {
    if (url && approvedTestDatabase(url))
      await sql(
        `DELETE FROM "Appointment" WHERE "businessId" IN ('${a}','${b}'); DELETE FROM "Business" WHERE id IN ('${a}','${b}');`,
      );
  });
  it("rejects customer references across tenant boundaries", async () => {
    await expect(
      sql(
        appointment(
          "foreign",
          "2030-01-01T10:00:00Z",
          "2030-01-01T10:30:00Z",
          "CONFIRMED",
          `${prefix}-foreign`,
        ),
      ),
    ).rejects.toThrow(/foreign key/i);
  });
  it("rejects invalid intervals", async () => {
    await expect(
      sql(
        appointment("invalid", "2030-01-01T11:00:00Z", "2030-01-01T10:00:00Z"),
      ),
    ).rejects.toThrow();
  });
  it("allows only one concurrent conflicting appointment to commit", async () => {
    const results = await Promise.allSettled([
      sql(
        `BEGIN; ${appointment("race-a", "2030-01-02T10:00:00Z", "2030-01-02T10:30:00Z")} SELECT pg_sleep(0.5); COMMIT;`,
      ),
      sql(
        `BEGIN; ${appointment("race-b", "2030-01-02T10:15:00Z", "2030-01-02T10:45:00Z")} COMMIT;`,
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((r) => r.status === "rejected");
    expect(
      failure?.status === "rejected" ? String(failure.reason) : "",
    ).toMatch(/exclusion constraint/i);
  });
  it("allows back-to-back and cancelled overlapping slots", async () => {
    await sql(
      appointment("boundary-a", "2030-01-03T10:00:00Z", "2030-01-03T10:30:00Z"),
    );
    await expect(
      sql(
        appointment(
          "boundary-b",
          "2030-01-03T10:30:00Z",
          "2030-01-03T11:00:00Z",
        ),
      ),
    ).resolves.toBeDefined();
    await expect(
      sql(
        appointment(
          "cancelled",
          "2030-01-03T10:15:00Z",
          "2030-01-03T10:45:00Z",
          "CANCELLED",
        ),
      ),
    ).resolves.toBeDefined();
  });
});
