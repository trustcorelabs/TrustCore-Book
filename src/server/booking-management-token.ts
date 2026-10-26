import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
const schema = z
  .object({
    v: z.literal(1),
    purpose: z.literal("booking-management"),
    businessId: z.string().cuid(),
    appointmentId: z.string().cuid(),
    expiresAt: z.number().int().positive(),
  })
  .strict();
export type BookingCapability = z.infer<typeof schema>;
function signature(payload: string, secret: string) {
  return createHmac("sha256", secret)
    .update("trustcore:booking-management:v1:" + payload)
    .digest();
}
export function issueBookingCapability(
  businessId: string,
  appointmentId: string,
  secret: string,
  now = Date.now(),
) {
  if (secret.length < 32) throw Error("Signing key is unavailable");
  const value = schema.parse({
    v: 1,
    purpose: "booking-management",
    businessId,
    appointmentId,
    expiresAt: now + 7 * 86400000,
  });
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return payload + "." + signature(payload, secret).toString("base64url");
}
export function verifyBookingCapability(
  token: unknown,
  secret: string,
  now = Date.now(),
): BookingCapability | null {
  if (
    secret.length < 32 ||
    typeof token !== "string" ||
    token.length > 1024 ||
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
    if (value.expiresAt <= now || value.expiresAt > now + 7 * 86400000)
      return null;
    return value;
  } catch {
    return null;
  }
}
