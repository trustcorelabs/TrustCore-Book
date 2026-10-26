import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/server/authorization";

const mocks = vi.hoisted(() => ({
  membershipLock: vi.fn(),
  serviceCreate: vi.fn(),
  businessUpdate: vi.fn(),
  auditCreate: vi.fn(),
  serviceUpdateMany: vi.fn(),
  appointmentUpdateMany: vi.fn(),
  appointmentCount: vi.fn(),
  exceptionCreate: vi.fn(),
  componentCount: vi.fn(),
  componentDelete: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: () => ({
    $transaction: (callback: (tx: unknown) => unknown) =>
      callback({
        $queryRaw: (...args: unknown[]) => mocks.membershipLock(...args),
        serviceComponent: {
          count: mocks.componentCount,
          deleteMany: mocks.componentDelete,
        },
        service: {
          create: mocks.serviceCreate,
          updateMany: mocks.serviceUpdateMany,
        },
        appointment: {
          updateMany: mocks.appointmentUpdateMany,
          count: mocks.appointmentCount,
        },
        scheduleException: { create: mocks.exceptionCreate },
        business: { update: mocks.businessUpdate },
        auditLog: { create: mocks.auditCreate },
      }),
  }),
}));

import {
  insertRecord,
  updateProfile,
  updateCatalogRecord,
  transitionAppointment,
  replaceStaffSchedule,
  createStaffTimeOff,
} from "@/server/repositories/workspace";

const scope = {
  businessId: "b1",
  actorId: "u1",
  role: "OWNER",
} as TenantContext;
const profile = {
  name: "Book Studio",
  slug: "book-studio",
  country: "LK" as const,
  timezone: "Asia/Colombo",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auditCreate.mockResolvedValue({ id: "audit-test" });
  mocks.componentCount.mockResolvedValue(0);
  mocks.componentDelete.mockResolvedValue({ count: 0 });
  mocks.serviceCreate.mockResolvedValue({ id: "service-1" });
});

describe("workspace write authorization (transaction mocked)", () => {
  it.each([
    { label: "removed", members: [] },
    { label: "read-only", members: [{ role: "MEMBER" }] },
  ])(
    "denies $label membership before any record write",
    async ({ members }) => {
      mocks.membershipLock.mockResolvedValue(members);
      await expect(
        insertRecord(scope, {
          kind: "services",
          input: {
            name: "Service",
            durationMinutes: 30,
            price: "10.00",
            kind: "SERVICE",
            categoryId: null,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            components: [],
          },
        }),
      ).rejects.toThrow("Tenant write denied");
      expect(mocks.serviceCreate).not.toHaveBeenCalled();
      expect(mocks.auditCreate).not.toHaveBeenCalled();
    },
  );

  it("checks the current membership with a row lock before updating settings", async () => {
    mocks.membershipLock.mockResolvedValue([{ role: "ADMIN" }]);
    await updateProfile(scope, profile);
    const [sql, businessId, actorId] = mocks.membershipLock.mock.calls[0]!;
    expect(sql.join("?")).toMatch(/"BusinessMember"[\s\S]*FOR SHARE/);
    expect([businessId, actorId]).toEqual(["b1", "u1"]);
    expect(mocks.businessUpdate).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: profile,
    });
    expect(mocks.membershipLock.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.businessUpdate.mock.invocationCallOrder[0]!,
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: {
        businessId: "b1",
        actorId: "u1",
        action: "business.updated",
        entityId: "b1",
      },
    });
  });

  it("rejects a demoted manager even if the earlier scope still says OWNER", async () => {
    mocks.membershipLock.mockResolvedValue([{ role: "MEMBER" }]);
    await expect(updateProfile(scope, profile)).rejects.toThrow(
      "Tenant write denied",
    );
    expect(mocks.businessUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("requires current manager membership before schedule or appointment mutations", async () => {
    mocks.membershipLock.mockResolvedValue([{ role: "MEMBER" }]);
    await expect(
      replaceStaffSchedule(scope, {
        staffId: "staff-1",
        serviceIds: [],
        rules: [],
      }),
    ).rejects.toThrow("Tenant write denied");
    await expect(
      transitionAppointment(scope, "appointment-1", "CANCELLED"),
    ).rejects.toThrow("Tenant write denied");
    expect(mocks.appointmentUpdateMany).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("scopes service edits and appointment transitions to the verified business", async () => {
    mocks.membershipLock.mockResolvedValue([{ role: "ADMIN" }]);
    mocks.serviceUpdateMany.mockResolvedValue({ count: 1 });
    mocks.appointmentUpdateMany.mockResolvedValue({ count: 1 });
    await updateCatalogRecord(scope, {
      kind: "services",
      input: {
        id: "service-1",
        kind: "SERVICE",
        categoryId: null,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        components: [],
        name: "Updated",
        durationMinutes: 45,
        price: "10.00",
        active: false,
      },
    });
    await transitionAppointment(scope, "appointment-1", "CANCELLED");
    expect(mocks.serviceUpdateMany).toHaveBeenCalledWith({
      where: { id: "service-1", businessId: "b1" },
      data: {
        name: "Updated",
        durationMinutes: 45,
        price: "10.00",
        active: false,
        kind: "SERVICE",
        categoryId: null,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
      },
    });
    expect(mocks.appointmentUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "appointment-1",
        businessId: "b1",
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      data: { status: "CANCELLED" },
    });
  });

  it("refuses time off that overlaps a non-cancelled appointment under the staff lock", async () => {
    mocks.membershipLock
      .mockResolvedValueOnce([{ role: "ADMIN" }])
      .mockResolvedValueOnce([{ id: "staff-1" }]);
    mocks.appointmentCount.mockResolvedValue(1);
    const from = new Date("2026-10-20T09:00:00Z");
    const to = new Date("2026-10-20T10:00:00Z");
    await expect(
      createStaffTimeOff(scope, "staff-1", from, to),
    ).rejects.toThrow(/conflicts/);
    expect(mocks.appointmentCount).toHaveBeenCalledWith({
      where: {
        businessId: "b1",
        staffId: "staff-1",
        status: { not: "CANCELLED" },
        occupiedStartsAt: { lt: to },
        occupiedEndsAt: { gt: from },
      },
    });
    expect(mocks.exceptionCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
