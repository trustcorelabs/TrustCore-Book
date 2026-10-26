import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { BookingCapability } from "./booking-management-token";
const lifetime = 15 * 60_000;
const schema = z
  .object({
    purpose: z.literal("customer-reschedule"),
    version: z.literal(1),
    businessId: z.string().cuid(),
    appointmentId: z.string().cuid(),
    expectedStartsAt: z.iso.datetime({ offset: true }),
    operationKey: z.uuid(),
    expiresAt: z.number().int().positive(),
  })
  .strict();
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update("trustcore:customer-reschedule:v1:" + payload)
    .digest();
}
export function issueRescheduleAuthorization(
  cap: BookingCapability,
  expectedStartsAt: string,
  secret: string,
  now = Date.now(),
) {
  if (secret.length < 32 || cap.expiresAt <= now)
    throw Error("Authorization unavailable");
  const value = schema.parse({
    purpose: "customer-reschedule",
    version: 1,
    businessId: cap.businessId,
    appointmentId: cap.appointmentId,
    expectedStartsAt,
    operationKey: randomUUID(),
    expiresAt: Math.min(cap.expiresAt, now + lifetime),
  });
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return payload + "." + signature(payload, secret).toString("base64url");
}
export function verifyRescheduleAuthorization(
  token: unknown,
  cap: BookingCapability,
  secret: string,
  now = Date.now(),
) {
  if (
    secret.length < 32 ||
    typeof token !== "string" ||
    token.length > 1400 ||
    !/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]{43}$/.test(token)
  )
    return null;
  try {
    const [payload, mac] = token.split(".");
    const actual = Buffer.from(mac!, "base64url"),
      expected = signature(payload!, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const value = schema.parse(
      JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")),
    );
    if (
      value.expiresAt <= now ||
      value.expiresAt > now + lifetime ||
      cap.expiresAt <= now ||
      value.expiresAt > cap.expiresAt ||
      value.businessId !== cap.businessId ||
      value.appointmentId !== cap.appointmentId
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
