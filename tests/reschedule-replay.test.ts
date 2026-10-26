import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  business: { findUniqueOrThrow: vi.fn() },
  bookingMutation: { findUnique: vi.fn() },
  appointment: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: () => ({
    $transaction: (fn: (tx: typeof mocks) => unknown) => fn(mocks),
  }),
}));
vi.mock("@/server/repositories/workspace", () => ({
  requireCurrentManager: vi.fn(),
}));
vi.mock("@/server/repositories/notification-jobs", () => ({
  enqueueAppointmentNotifications: vi.fn(),
}));
import { rescheduleManagedBooking } from "@/server/repositories/rescheduling";
import type { BookingCapability } from "@/server/booking-management-token";
const now = new Date("2026-10-26T10:00:00Z");
const cap: BookingCapability = {
  v: 1,
  purpose: "booking-management",
  businessId: "tenant-a",
  appointmentId: "appointment-a",
  expiresAt: now.getTime() + 900_000,
};
const move = {
  startsAt: "2026-10-28T10:00:00.000Z",
  expectedStartsAt: "2026-10-27T10:00:00.000Z",
  operationKey: "server-issued-operation",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.$queryRaw.mockResolvedValue([{ id: cap.businessId }]);
  mocks.business.findUniqueOrThrow.mockResolvedValue({
    timezone: "Asia/Colombo",
  });
  mocks.bookingMutation.findUnique.mockResolvedValue({
    appointmentId: cap.appointmentId,
    payloadHash: createHash("sha256")
      .update(
        JSON.stringify([
          cap.appointmentId,
          move.startsAt,
          move.expectedStartsAt,
        ]),
      )
      .digest("hex"),
  });
});
it("returns an identical durable replay without mutating the appointment again", async () => {
  await rescheduleManagedBooking(cap, move, now);
  expect(mocks.bookingMutation.findUnique).toHaveBeenCalledWith({
    where: {
      businessId_operationKey: {
        businessId: cap.businessId,
        operationKey: move.operationKey,
      },
    },
  });
  expect(mocks.appointment.findFirst).not.toHaveBeenCalled();
});
it("rejects changed targets and cross-appointment reuse of a consumed operation", async () => {
  await expect(
    rescheduleManagedBooking(
      cap,
      { ...move, startsAt: "2026-10-29T10:00:00.000Z" },
      now,
    ),
  ).rejects.toThrow("Invalid operation replay");
  await expect(
    rescheduleManagedBooking({ ...cap, appointmentId: "other" }, move, now),
  ).rejects.toThrow("Invalid operation replay");
  expect(mocks.appointment.findFirst).not.toHaveBeenCalled();
});
it("does not accept a consumed operation after the short-lived grant expires", async () => {
  await expect(
    rescheduleManagedBooking(cap, move, new Date(cap.expiresAt)),
  ).rejects.toThrow("Invalid operation replay");
  expect(mocks.appointment.findFirst).not.toHaveBeenCalled();
});
