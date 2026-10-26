import { expect, it } from "vitest";
import {
  amountToMinorUnits,
  disabledPaymentGateway,
} from "@/server/payments/gateway";
import {
  disabledNotificationQueue,
  notificationKey,
  appointmentEmailText,
} from "@/server/notifications/contracts";
it("keeps payments disabled and converts supported money without float rounding", async () => {
  expect(amountToMinorUnits("10.01", "LKR")).toBe(1001);
  expect(() => amountToMinorUnits("1.999", "AUD")).toThrow();
  expect(() => amountToMinorUnits("0", "LKR")).toThrow();
  expect(() => amountToMinorUnits("10", "JPY")).toThrow();
  expect(disabledPaymentGateway.mode).toBe("disabled");
  expect(
    await disabledPaymentGateway.createCheckout({
      businessId: "b",
      appointmentId: "a",
      currency: "LKR",
      amountMinor: 100,
      idempotencyKey: "k",
    }),
  ).toEqual({ configured: false, reason: "provider-not-configured" });
});
it("never claims reminder delivery and separates revisions and tenants in the deduplication identity", async () => {
  const n = {
    kind: "REMINDER" as const,
    businessId: "b",
    appointmentId: "a",
    recipient: "fixture@example.invalid",
    revision: "1",
    scheduledFor: "2026-10-25T10:00:00Z",
  };
  expect(await disabledNotificationQueue.enqueue(n)).toEqual({
    queued: false,
    reason: "delivery-not-configured",
  });
  expect(notificationKey(n)).not.toBe(
    notificationKey({ ...n, businessId: "other" }),
  );
  expect(notificationKey(n)).not.toBe(notificationKey({ ...n, revision: "2" }));
  expect(notificationKey(n)).not.toContain("fixture@example.invalid");
  expect(
    appointmentEmailText({
      businessName: "Studio",
      serviceName: "Care",
      kind: "CONFIRMED",
      timezone: "Asia/Colombo",
      startsAt: "2026-10-25T10:00:00Z",
    }),
  ).toContain("Asia/Colombo");
});
