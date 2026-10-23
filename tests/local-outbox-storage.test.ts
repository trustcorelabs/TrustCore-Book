import {
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readLocalOutbox, writeLocalOutbox } from "@/server/local-outbox";
import type { LocalOutboxTarget } from "@/server/local-outbox-target";

const target: LocalOutboxTarget = {
  origin: "http://localhost:3000",
  host: "ep-wild-cloud-b52apabm.c-7.us-east-2.aws.neon.tech",
  database: "trustcore_book_a1_test",
  projectId: "quiet-mouse-55892784",
  branchId: "br-late-sunset-b5k5go82",
  branchName: "trustcore-book-a1-test",
  apiKey: "test-only-api-key",
  accessToken: "A".repeat(43),
};
let directory = "";

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = "";
});

describe("encrypted local outbox storage", () => {
  it("stores a verification link encrypted and only returns active messages", async () => {
    directory = await mkdtemp(
      join(await realpath(tmpdir()), "trustcore-outbox-test-"),
    );
    vi.stubEnv("LOCAL_OUTBOX_DIR", directory);
    const message = {
      kind: "VERIFY_EMAIL" as const,
      recipient: "owner@example.test",
      link: `http://localhost:3000/verify-email#token=${"A".repeat(43)}`,
    };
    const before = Date.now();
    await writeLocalOutbox(target, message);
    const names = await readdir(directory);
    expect(names).toHaveLength(1);
    const raw = await readFile(`${directory}/${names[0]}`, "utf8");
    expect(raw).not.toContain(message.link);
    expect(raw).not.toContain(message.recipient);
    expect((await stat(`${directory}/${names[0]}`)).mode & 0o077).toBe(0);
    expect(await readLocalOutbox(target)).toMatchObject([{ ...message }]);
    vi.spyOn(Date, "now").mockReturnValue(before + 61 * 60_000);
    expect(await readLocalOutbox(target)).toEqual([]);
    expect(await readdir(directory)).toEqual([]);
  });

  it("cannot decrypt another branch's outbox entries", async () => {
    directory = await mkdtemp(
      join(await realpath(tmpdir()), "trustcore-outbox-test-"),
    );
    vi.stubEnv("LOCAL_OUTBOX_DIR", directory);
    await writeLocalOutbox(target, {
      kind: "RESET_PASSWORD",
      recipient: "owner@example.test",
      link: `http://localhost:3000/reset-password#token=${"B".repeat(43)}`,
    });
    expect(
      await readLocalOutbox({ ...target, branchId: "br-another" }),
    ).toEqual([]);
  });
});
