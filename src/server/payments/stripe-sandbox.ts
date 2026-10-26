import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  assertSandboxRequest,
  type PaymentGateway,
  disabledPaymentGateway,
} from "./gateway";
export type StripeSandboxConfig = {
  enabled: boolean;
  secretKey: string;
  businessId: string;
  merchantCountry: "AE" | "AU";
  returnOrigin: string;
};
/** Explicit, tenant-bound test adapter. No environment auto-detection or live-key path. */
export function stripeSandboxGateway(
  config: StripeSandboxConfig,
  fetcher: typeof fetch = fetch,
): PaymentGateway {
  if (!config.enabled) return disabledPaymentGateway;
  if (
    !/^sk_test_[A-Za-z0-9_]{16,}$/.test(config.secretKey) ||
    !["AE", "AU"].includes(config.merchantCountry) ||
    !z.string().cuid().safeParse(config.businessId).success
  )
    throw Error("Verified tenant sandbox configuration required");
  const origin = new URL(config.returnOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw Error("HTTPS return origin required");
  return {
    mode: "sandbox",
    async createCheckout(input) {
      assertSandboxRequest(input);
      if (
        input.businessId !== config.businessId ||
        input.currency !== (config.merchantCountry === "AE" ? "AED" : "AUD") ||
        !Number.isSafeInteger(input.amountMinor) ||
        input.amountMinor > 99999999 ||
        !z.uuid().safeParse(input.idempotencyKey).success
      )
        throw Error("Sandbox tenant/currency/request binding failed");
      const data = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": input.currency.toLowerCase(),
        "line_items[0][price_data][unit_amount]": String(input.amountMinor),
        "line_items[0][price_data][product_data][name]":
          "Appointment sandbox payment",
        "line_items[0][quantity]": "1",
        "metadata[businessId]": config.businessId,
        "metadata[appointmentId]": input.appointmentId,
        success_url: origin.origin + "/payments/return",
        cancel_url: origin.origin + "/payments/return",
      });
      const response = await fetcher(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + config.secretKey,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": `trustcore:${config.businessId}:${input.idempotencyKey}`,
          },
          body: data,
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        },
      );
      if (!response.ok) throw Error("Sandbox gateway request failed");
      const parsed = z
        .object({
          id: z.string().regex(/^cs_test_[A-Za-z0-9]+$/),
          livemode: z.literal(false),
          url: z.url(),
        })
        .safeParse(await response.json());
      if (!parsed.success)
        throw Error("Sandbox gateway response could not be verified");
      const url = new URL(parsed.data.url);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "checkout.stripe.com" ||
        url.username ||
        url.password
      )
        throw Error("Untrusted checkout destination");
      return {
        configured: true,
        mode: "sandbox",
        checkoutUrl: url.toString(),
        providerReference: parsed.data.id,
      };
    },
  };
}
const eventSchema = z.object({
  id: z.string().regex(/^evt_[A-Za-z0-9]+$/),
  livemode: z.literal(false),
  type: z.string().min(1).max(100),
  data: z.object({ object: z.record(z.string(), z.unknown()) }),
});
/** Signature authentication only. Durable event deduplication and ledger reconciliation
 * are mandatory before any consumer may grant entitlements or mark money collected. */
export function verifyStripeSandboxEvent(
  raw: Buffer,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (raw.length > 1024 * 1024 || header.length > 4096 || secret.length < 24)
    throw Error("Invalid sandbox webhook");
  const parts = header.split(",").map((x) => x.trim().split("="));
  const timestamps = parts.filter((p) => p[0] === "t");
  const signatures = parts
    .filter((p) => p[0] === "v1" && /^[a-f0-9]{64}$/.test(p[1] ?? ""))
    .slice(0, 10);
  if (timestamps.length !== 1 || !/^\d{1,12}$/.test(timestamps[0]?.[1] ?? ""))
    throw Error("Invalid webhook timestamp");
  const timestamp = Number(timestamps[0]![1]);
  if (Math.abs(nowSeconds - timestamp) > 300)
    throw Error("Expired webhook timestamp");
  const expected = createHmac("sha256", secret)
    .update(String(timestamp) + ".")
    .update(raw)
    .digest();
  if (
    !signatures.some((p) =>
      timingSafeEqual(Buffer.from(p[1]!, "hex"), expected),
    )
  )
    throw Error("Webhook signature rejected");
  return eventSchema.parse(JSON.parse(raw.toString("utf8")));
}
