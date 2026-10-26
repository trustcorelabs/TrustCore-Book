import { expect, it } from "vitest";
import {
  issueBookingCapability,
  verifyBookingCapability,
} from "@/server/booking-management-token";
import {
  issueRescheduleAuthorization,
  verifyRescheduleAuthorization,
} from "@/server/reschedule-authorization";
const secret = "synthetic-reschedule-secret-with-at-least-32-characters";
const now = Date.parse("2026-10-26T10:00:00Z");
const cap = verifyBookingCapability(
  issueBookingCapability(
    "cm12345678901234567890123",
    "cm22345678901234567890123",
    secret,
    now,
  ),
  secret,
  now,
)!;
const original = "2026-10-28T10:00:00.000Z";
it("binds each grant to a tenant, appointment, original start and server-issued operation key", () => {
  const token = issueRescheduleAuthorization(cap, original, secret, now);
  const value = verifyRescheduleAuthorization(token, cap, secret, now)!;
  expect(value).toMatchObject({
    businessId: cap.businessId,
    appointmentId: cap.appointmentId,
    expectedStartsAt: original,
    expiresAt: now + 15 * 60_000,
  });
  expect(value.operationKey).toMatch(/^[0-9a-f-]{36}$/);
  expect(
    verifyRescheduleAuthorization(
      token,
      { ...cap, businessId: "cm32345678901234567890123" },
      secret,
      now,
    ),
  ).toBeNull();
  expect(
    verifyRescheduleAuthorization(
      token,
      { ...cap, appointmentId: "cm32345678901234567890123" },
      secret,
      now,
    ),
  ).toBeNull();
});
it("expires at 15 minutes or the parent capability expiry, whichever comes first", () => {
  const token = issueRescheduleAuthorization(cap, original, secret, now);
  expect(
    verifyRescheduleAuthorization(token, cap, secret, now + 15 * 60_000 - 1),
  ).not.toBeNull();
  expect(
    verifyRescheduleAuthorization(token, cap, secret, now + 15 * 60_000),
  ).toBeNull();
  const shortCap = { ...cap, expiresAt: now + 1000 };
  const shortToken = issueRescheduleAuthorization(
    shortCap,
    original,
    secret,
    now,
  );
  expect(
    verifyRescheduleAuthorization(shortToken, shortCap, secret, now)!.expiresAt,
  ).toBe(shortCap.expiresAt);
  expect(
    verifyRescheduleAuthorization(shortToken, shortCap, secret, now + 1000),
  ).toBeNull();
});
it("rejects management tokens, tampering, malformed input and wrong keys", () => {
  const token = issueRescheduleAuthorization(cap, original, secret, now);
  for (const invalid of [
    null,
    {},
    "a".repeat(1500),
    token + "a",
    issueBookingCapability(cap.businessId, cap.appointmentId, secret, now),
  ])
    expect(verifyRescheduleAuthorization(invalid, cap, secret, now)).toBeNull();
  const [payload, mac] = token.split(".");
  const body = JSON.parse(Buffer.from(payload!, "base64url").toString());
  body.expectedStartsAt = "2026-10-30T10:00:00.000Z";
  expect(
    verifyRescheduleAuthorization(
      Buffer.from(JSON.stringify(body)).toString("base64url") + "." + mac,
      cap,
      secret,
      now,
    ),
  ).toBeNull();
  expect(
    verifyRescheduleAuthorization(token, cap, secret + "wrong", now),
  ).toBeNull();
  expect(verifyRescheduleAuthorization(token, cap, "short", now)).toBeNull();
  expect(() =>
    issueRescheduleAuthorization(
      { ...cap, expiresAt: now },
      original,
      secret,
      now,
    ),
  ).toThrow();
});
