import { beforeEach, expect, it, vi } from "vitest";
import type { TenantContext } from "@/server/authorization";
const mocks = vi.hoisted(() => ({
  appointment: { findMany: vi.fn() },
  staff: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn() },
  customer: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: () => mocks }));
import {
  readCalendar,
  readReportAppointments,
  readAudit,
  readCustomerHistory,
} from "@/server/repositories/insights";
const scope = {
  businessId: "tenant-a",
  actorId: "user-a",
  role: "OWNER",
} as TenantContext;
const from = new Date("2026-10-01T00:00:00Z"),
  to = new Date("2026-11-01T00:00:00Z");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.appointment.findMany.mockResolvedValue([]);
  mocks.staff.findMany.mockResolvedValue([]);
});
it("pins the tenant on appointments, staff and nested schedule/exception reads", async () => {
  await readCalendar(scope, from, to);
  expect(mocks.appointment.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        businessId: "tenant-a",
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
      take: 2001,
    }),
  );
  const query = mocks.staff.findMany.mock.calls[0]![0];
  expect(query.where).toEqual({ businessId: "tenant-a" });
  expect(query.select.availability.where.businessId).toBe("tenant-a");
  expect(query.select.exceptions.where.businessId).toBe("tenant-a");
});
it("uses a half-open report window, does not select customer contacts or price, and detects truncation", async () => {
  mocks.appointment.findMany.mockResolvedValue(
    Array.from({ length: 10001 }, () => ({})),
  );
  const r = await readReportAppointments(scope, from, to);
  expect(r.truncated).toBe(true);
  expect(r.rows).toHaveLength(10000);
  const q = mocks.appointment.findMany.mock.calls[0]![0];
  expect(q.where).toEqual({
    businessId: "tenant-a",
    startsAt: { gte: from, lt: to },
  });
  expect(q.select).not.toHaveProperty("price");
  expect(q.select).not.toHaveProperty("customer");
});
it("scopes customer profiles and their nested visits independently", async () => {
  await readCustomerHistory(scope, "foreign-customer");
  const q = mocks.customer.findFirst.mock.calls[0]![0];
  expect(q.where).toEqual({ id: "foreign-customer", businessId: "tenant-a" });
  expect(q.select.appointments.where).toEqual({ businessId: "tenant-a" });
});
it("bounds audit reads and selects no actor email", async () => {
  await readAudit(scope);
  const q = mocks.auditLog.findMany.mock.calls[0]![0];
  expect(q.where.businessId).toBe("tenant-a");
  expect(q.take).toBe(100);
  expect(q.select.actor.select).toEqual({ name: true });
});
