import { beforeEach, expect, it, vi } from "vitest";
import type { TenantContext } from "@/server/authorization";
const mocks = vi.hoisted(() => ({
  requireTenant: vi.fn(),
  rateLimit: vi.fn(),
  manager: vi.fn(),
  customer: { findFirst: vi.fn() },
  customerNote: { create: vi.fn(), findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("@/server/authorization", () => ({
  requireTenant: mocks.requireTenant,
}));
vi.mock("@/server/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/server/repositories/workspace", () => ({
  requireCurrentManager: mocks.manager,
}));
vi.mock("@/lib/db", () => ({
  db: () => ({
    $transaction: (fn: (tx: typeof mocks) => unknown) => fn(mocks),
  }),
}));
import {
  insertCustomerNote,
  readCustomerNotes,
} from "@/server/repositories/customer-notes";
import { addCustomerNoteService, customerNotes } from "@/server/customer-notes";
const scope = {
  businessId: "cm12345678901234567890123",
  actorId: "owner",
  role: "OWNER",
} as TenantContext;
const customerId = "cm22345678901234567890123";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireTenant.mockResolvedValue({
    context: scope,
    user: { id: "owner" },
  });
  mocks.customer.findFirst.mockResolvedValue({ id: customerId });
  mocks.customerNote.create.mockResolvedValue({ id: "note" });
});
it("requires manager authorization before reads and writes", async () => {
  mocks.requireTenant.mockRejectedValue(Error("Denied"));
  await expect(
    addCustomerNoteService(scope.businessId, {
      customerId,
      body: "Preference",
    }),
  ).rejects.toThrow("Denied");
  await expect(customerNotes(scope.businessId, customerId)).rejects.toThrow(
    "Denied",
  );
  expect(mocks.requireTenant).toHaveBeenCalledWith(scope.businessId, true);
  expect(mocks.customerNote.create).not.toHaveBeenCalled();
});
it("rechecks current membership inside the transaction before reading or mutating", async () => {
  mocks.manager.mockRejectedValue(Error("Revoked"));
  await expect(
    insertCustomerNote(scope, customerId, "Preference"),
  ).rejects.toThrow("Revoked");
  await expect(readCustomerNotes(scope, customerId)).rejects.toThrow("Revoked");
  expect(mocks.customer.findFirst).not.toHaveBeenCalled();
  expect(mocks.customerNote.findMany).not.toHaveBeenCalled();
});
it("rejects foreign customers without creating a note or audit event", async () => {
  mocks.customer.findFirst.mockResolvedValue(null);
  await expect(
    insertCustomerNote(scope, customerId, "Preference"),
  ).rejects.toThrow();
  expect(mocks.customer.findFirst).toHaveBeenCalledWith({
    where: { businessId: scope.businessId, id: customerId },
    select: { id: true },
  });
  expect(mocks.customerNote.create).not.toHaveBeenCalled();
  expect(mocks.auditLog.create).not.toHaveBeenCalled();
});
it("stores bounded trimmed notes with server-controlled ownership and a content-free audit", async () => {
  const result = await addCustomerNoteService(scope.businessId, {
    customerId,
    body: "  Prefers a quiet session  ",
    businessId: "foreign",
    authorId: "foreign",
  });
  expect(result.success).toBe("Note added.");
  expect(mocks.rateLimit).toHaveBeenCalledWith("customer-note:owner", 30, 60);
  expect(mocks.customerNote.create).toHaveBeenCalledWith({
    data: {
      businessId: scope.businessId,
      customerId,
      authorId: "owner",
      body: "Prefers a quiet session",
    },
  });
  expect(JSON.stringify(mocks.auditLog.create.mock.calls)).not.toContain(
    "quiet",
  );
});
it.each([" ", "a".repeat(2001)])(
  "validates note text before a repository write",
  async (body) => {
    expect(
      (await addCustomerNoteService(scope.businessId, { customerId, body }))
        .error,
    ).toBeTruthy();
    expect(mocks.customerNote.create).not.toHaveBeenCalled();
  },
);
it("bounds reads and returns no author email or credentials", async () => {
  await readCustomerNotes(scope, customerId);
  expect(mocks.customerNote.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { businessId: scope.businessId, customerId },
      take: 51,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
      },
    }),
  );
});
