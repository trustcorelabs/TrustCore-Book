import { describe, expect, it, vi } from "vitest";
import {
  checkDevelopmentTarget,
  parseDevelopmentUrl,
} from "../scripts/check-development-target.mjs";

const host = "ep-example.c-7.us-east-2.aws.neon.tech";
const url = `postgresql://test:test@${host}/neondb?sslmode=verify-full`;
const response = (body: unknown) => ({ ok: true, json: async () => body });
const metadata = vi.fn(async (target: string) => {
  if (target.endsWith("/br-dark-brook-b4vdolwu"))
    return response({
      branch: { id: "br-dark-brook-b4vdolwu", name: "production" },
    });
  if (target.endsWith("/endpoints"))
    return response({
      endpoints: [
        {
          host,
          branch_id: "br-dark-brook-b4vdolwu",
          project_id: "fragrant-hat-50630079",
          type: "read_write",
        },
      ],
    });
  return response({
    project: { id: "fragrant-hat-50630079", name: "trustcore-book-dev" },
  });
});

describe("read-only development target check", () => {
  it("rejects pooled, weak-TLS and unrelated database URLs", () => {
    expect(parseDevelopmentUrl(url)).not.toBeNull();
    expect(
      parseDevelopmentUrl(url.replace("ep-example", "ep-example-pooler")),
    ).toBeNull();
    expect(
      parseDevelopmentUrl(url.replace("verify-full", "require")),
    ).toBeNull();
    expect(parseDevelopmentUrl(url.replace("/neondb", "/other"))).toBeNull();
  });

  it("does not query SQL before trusted Neon metadata matches", async () => {
    const sql = vi.fn();
    const wrong = vi.fn(async () =>
      response({ project: { id: "quiet-mouse-55892784" } }),
    );
    await expect(
      checkDevelopmentTarget(url, "test-key", wrong, sql),
    ).rejects.toThrow();
    expect(sql).not.toHaveBeenCalled();
  });

  it("recognizes an empty schema without making a write", async () => {
    const sql = vi.fn((_target: URL, statement: string) => {
      if (statement.includes("current_database")) return "neondb";
      if (statement.includes("information_schema")) return "0";
      return "f";
    });
    await expect(
      checkDevelopmentTarget(url, "test-key", metadata, sql),
    ).resolves.toMatchObject({ state: "empty" });
    expect(sql).toHaveBeenCalledTimes(3);
    expect(
      sql.mock.calls.every(([, statement]) => statement.startsWith("SELECT")),
    ).toBe(true);
  });

  it("refuses a complete migration ledger when identity columns are missing", async () => {
    const sql = vi.fn((_target: URL, statement: string) => {
      if (statement.includes("current_database")) return "neondb";
      if (
        statement.includes("information_schema.tables") &&
        statement.includes("table_type")
      )
        return "17";
      if (statement.includes("to_regclass")) return "t";
      if (statement.includes("SELECT migration_name"))
        return [
          "20261018000000_initial",
          "20261018010000_phase_a1_identity",
          "20261019010000_phase_a2_invitations",
          "20261019020000_phase_a2_final_owner_guard",
          "20261019030000_booking_idempotency",
        ].join("\n");
      if (statement.includes("finished_at IS NULL")) return "0";
      if (statement.includes("information_schema.tables")) return "8";
      return "5";
    });
    await expect(
      checkDevelopmentTarget(url, "test-key", metadata, sql),
    ).rejects.toThrow(/columns/);
  });
  it.each([
    { guards: "3", index: "1", ready: true },
    { guards: "2", index: "1", ready: false },
    { guards: "3", index: "0", ready: false },
  ])(
    "requires actual booking constraints, not only a migration ledger: $guards/$index",
    async ({ guards, index, ready }) => {
      const sql = vi.fn((_target: URL, statement: string) => {
        if (statement.includes("current_database")) return "neondb";
        if (statement.includes("table_type")) return "17";
        if (
          statement.includes("to_regclass") &&
          !statement.includes("pg_index")
        )
          return "t";
        if (statement.includes("SELECT migration_name"))
          return [
            "20261018000000_initial",
            "20261018010000_phase_a1_identity",
            "20261019010000_phase_a2_invitations",
            "20261019020000_phase_a2_final_owner_guard",
            "20261019030000_booking_idempotency",
          ].join("\n");
        if (statement.includes("finished_at IS NULL")) return "0";
        if (statement.includes("information_schema.tables")) return "8";
        if (statement.includes("information_schema.columns")) return "6";
        if (statement.includes("pg_constraint")) return guards;
        if (statement.includes("pg_index")) return index;
        throw new Error("Unexpected query");
      });
      const result = checkDevelopmentTarget(url, "test-key", metadata, sql);
      if (ready)
        await expect(result).resolves.toMatchObject({ state: "ready" });
      else await expect(result).rejects.toThrow(/constraints/);
      expect(
        sql.mock.calls.every(([, statement]) => statement.startsWith("SELECT")),
      ).toBe(true);
    },
  );
});
