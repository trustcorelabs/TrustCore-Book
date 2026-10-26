import { expect, it } from "vitest";
import {
  nextNotificationRetry,
  reminderEligibility,
} from "@/server/notifications/contracts";
it("bounds provider retry delays and stops retrying after the fourth attempt", () => {
  const now = new Date("2026-10-25T10:00:00Z");
  expect(nextNotificationRetry(0, now)?.getTime()).toBe(now.getTime() + 60000);
  expect(nextNotificationRetry(0, now, 500)?.getTime()).toBe(
    now.getTime() + 500000,
  );
  expect(nextNotificationRetry(4, now)).toBeNull();
  expect(nextNotificationRetry(-1, now)).toBeNull();
});
it("does not send reminders for opted-out, cancelled, completed or past appointments", () => {
  const input = {
    status: "CONFIRMED",
    startsAt: new Date("2026-10-26T10:00:00Z"),
    scheduledFor: new Date("2026-10-25T10:00:00Z"),
    now: new Date("2026-10-25T10:00:00Z"),
    consent: true,
  };
  expect(reminderEligibility(input)).toBe(true);
  for (const status of ["CANCELLED", "NO_SHOW", "COMPLETED"])
    expect(reminderEligibility({ ...input, status })).toBe(false);
  expect(reminderEligibility({ ...input, consent: false })).toBe(false);
  expect(
    reminderEligibility({ ...input, now: new Date("2026-10-27T00:00:00Z") }),
  ).toBe(false);
});
