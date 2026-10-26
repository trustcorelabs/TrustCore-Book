import { beforeEach, expect, it, vi } from "vitest";
import { issueBookingCapability } from "@/server/booking-management-token";
const mocks = vi.hoisted(() => ({
  slots: vi.fn(),
  move: vi.fn(),
  limit: vi.fn(),
}));
const secret = "synthetic-service-reschedule-key-over-32-characters";
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    NEXTAUTH_SECRET: "synthetic-service-reschedule-key-over-32-characters",
  }),
}));
vi.mock("@/server/rate-limit", () => ({ rateLimit: mocks.limit }));
vi.mock("@/server/repositories/rescheduling", () => ({
  managedRescheduleSlots: mocks.slots,
  rescheduleManagedBooking: mocks.move,
}));
vi.mock("@/server/repositories/booking-management", () => ({
  readManagedBooking: vi.fn(),
  cancelManagedBooking: vi.fn(),
  changeManagedEmailPreference: vi.fn(),
}));
import {
  customerRescheduleSlots,
  rescheduleCustomerBooking,
} from "@/server/booking-management";
const business = "cm12345678901234567890123",
  appointment = "cm22345678901234567890123";
const token = () => issueBookingCapability(business, appointment, secret);
const original = "2026-11-10T10:00:00.000Z",
  target = "2026-11-11T10:00:00.000Z";
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("BOOKING_MVP_ENABLED", "true");
  mocks.slots.mockResolvedValue({
    expectedStartsAt: original,
    timezone: "Asia/Colombo",
    slots: [{ startsAt: target, endsAt: "2026-11-11T11:00:00.000Z" }],
  });
});
it("does not accept a seven-day management link alone as a move authorization", async () => {
  const result = await rescheduleCustomerBooking(
    token(),
    {
      startsAt: target,
      expectedStartsAt: original,
      operationKey: "c7feff8d-7a09-4fa1-a309-0c71d62cbce8",
    },
    "client",
  );
  expect(result.error).toBeTruthy();
  expect(mocks.move).not.toHaveBeenCalled();
});
it("uses the grant's original start and operation key, ignoring client-supplied overrides", async () => {
  const link = token();
  const data = await customerRescheduleSlots(link, "2026-11-11", "client");
  expect(data.authorization).toBeTruthy();
  const input = {
    startsAt: target,
    authorization: data.authorization,
    expectedStartsAt: target,
    operationKey: "client-controlled",
  };
  expect(
    (await rescheduleCustomerBooking(link, input, "client")).success,
  ).toBeTruthy();
  expect(
    (await rescheduleCustomerBooking(link, input, "client")).success,
  ).toBeTruthy();
  const [cap, move] = mocks.move.mock.calls[0]!;
  expect(cap.expiresAt).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
  expect(move.expectedStartsAt).toBe(original);
  expect(move.operationKey).not.toBe("client-controlled");
  expect(mocks.move.mock.calls[1]![1].operationKey).toBe(move.operationKey);
});
it("rejects cross-appointment grants before any mutation", async () => {
  const data = await customerRescheduleSlots(token(), "2026-11-11", "client");
  const other = issueBookingCapability(
    business,
    "cm32345678901234567890123",
    secret,
  );
  expect(
    (
      await rescheduleCustomerBooking(
        other,
        { startsAt: target, authorization: data.authorization },
        "client",
      )
    ).error,
  ).toBeTruthy();
  expect(mocks.move).not.toHaveBeenCalled();
});
it("keeps slot discovery and mutation disabled when the booking flag is off", async () => {
  vi.stubEnv("BOOKING_MVP_ENABLED", "false");
  expect(
    (await customerRescheduleSlots(token(), "2026-11-11", "client")).error,
  ).toBeTruthy();
  expect(
    (
      await rescheduleCustomerBooking(
        token(),
        { startsAt: target, authorization: "invalid" },
        "client",
      )
    ).error,
  ).toBeTruthy();
  expect(mocks.slots).not.toHaveBeenCalled();
  expect(mocks.move).not.toHaveBeenCalled();
});
