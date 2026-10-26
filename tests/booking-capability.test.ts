import { expect, it } from "vitest";
import {
  issueBookingCapability,
  verifyBookingCapability,
} from "@/server/booking-management-token";
const business = "cm12345678901234567890123",
  appointment = "cm22345678901234567890123",
  secret = "test-only-capability-key-that-is-at-least-32-characters",
  now = Date.parse("2026-10-25T10:00:00Z");
it("binds a domain-separated capability to one business/appointment and a seven-day lifetime", () => {
  const token = issueBookingCapability(business, appointment, secret, now);
  expect(verifyBookingCapability(token, secret, now)).toMatchObject({
    businessId: business,
    appointmentId: appointment,
    purpose: "booking-management",
  });
  expect(verifyBookingCapability(token, secret, now + 7 * 86400000)).toBeNull();
  expect(verifyBookingCapability(token, secret + "wrong", now)).toBeNull();
  expect(verifyBookingCapability(token + "x", secret, now)).toBeNull();
  const [payload, mac] = token.split(".");
  const value = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8"));
  value.businessId = "cm32345678901234567890123";
  expect(
    verifyBookingCapability(
      Buffer.from(JSON.stringify(value)).toString("base64url") + "." + mac,
      secret,
      now,
    ),
  ).toBeNull();
});
it("rejects oversize, malformed and weak-key tokens without throwing", () => {
  for (const t of [null, {}, "a".repeat(2000), "bad.token", ""])
    expect(verifyBookingCapability(t, secret, now)).toBeNull();
  expect(verifyBookingCapability("abc", "short", now)).toBeNull();
});
