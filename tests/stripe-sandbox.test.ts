import { expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  stripeSandboxGateway,
  verifyStripeSandboxEvent,
  type StripeSandboxConfig,
} from "@/server/payments/stripe-sandbox";
const config: StripeSandboxConfig = {
  enabled: true,
  secretKey: "sk_test_synthetic_key_not_real_000000",
  businessId: "cm12345678901234567890123",
  merchantCountry: "AU",
  returnOrigin: "https://preview.example.invalid",
};
const request = {
  businessId: config.businessId,
  appointmentId: "cm22345678901234567890123",
  currency: "AUD" as const,
  amountMinor: 1001,
  idempotencyKey: "6c43bdca-4444-4444-8888-111111111111",
};
it("rejects live keys, unsupported merchant countries, other tenants and currencies before provider calls", async () => {
  expect(() =>
    stripeSandboxGateway({ ...config, secretKey: "sk_live_not_allowed" }),
  ).toThrow();
  expect(() =>
    stripeSandboxGateway({ ...config, merchantCountry: "LK" as "AU" }),
  ).toThrow();
  const f = vi.fn();
  const g = stripeSandboxGateway(config, f);
  await expect(
    g.createCheckout({ ...request, businessId: "other" }),
  ).rejects.toThrow();
  await expect(
    g.createCheckout({ ...request, currency: "LKR" }),
  ).rejects.toThrow();
  expect(f).not.toHaveBeenCalled();
});
it("uses server-owned amounts, metadata and idempotency and only accepts a test checkout destination", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "cs_test_fixture",
        livemode: false,
        url: "https://checkout.stripe.com/c/pay/cs_test_fixture",
      }),
    ),
  );
  const g = stripeSandboxGateway(config, f);
  const result = await g.createCheckout(request);
  expect(result).toMatchObject({
    mode: "sandbox",
    configured: true,
    providerReference: "cs_test_fixture",
  });
  expect(f).toHaveBeenCalledOnce();
  const init = f.mock.calls[0]![1];
  expect(init.body.get("line_items[0][price_data][unit_amount]")).toBe("1001");
  expect(init.body.get("metadata[businessId]")).toBe(config.businessId);
  expect(init.headers["Idempotency-Key"]).toContain(request.idempotencyKey);
  f.mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "cs_test_fixture",
        livemode: false,
        url: "https://evil.example/checkout",
      }),
    ),
  );
  await expect(g.createCheckout(request)).rejects.toThrow(/Untrusted/);
});
it("authenticates raw signed test events but rejects tampering, expired timestamps and live events", () => {
  const now = 1792920000,
    secret = "whsec_synthetic_not_a_real_secret";
  const raw = Buffer.from(
    JSON.stringify({
      id: "evt_fixture",
      livemode: false,
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_fixture" } },
    }),
  );
  const sign = (b: Buffer, t = now) =>
    `t=${t},v1=${createHmac("sha256", secret)
      .update(t + ".")
      .update(b)
      .digest("hex")}`;
  expect(verifyStripeSandboxEvent(raw, sign(raw), secret, now).id).toBe(
    "evt_fixture",
  );
  expect(() =>
    verifyStripeSandboxEvent(Buffer.from("{}"), sign(raw), secret, now),
  ).toThrow();
  expect(() =>
    verifyStripeSandboxEvent(raw, sign(raw, now - 301), secret, now),
  ).toThrow();
  const live = Buffer.from(raw.toString().replace("false", "true"));
  expect(() =>
    verifyStripeSandboxEvent(live, sign(live), secret, now),
  ).toThrow();
});
