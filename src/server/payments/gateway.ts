import "server-only";
/** Disabled by default. A browser redirect never authorizes a payment or entitlement. */
export type PaymentRequest = {
  businessId: string;
  appointmentId: string;
  currency: "LKR" | "MVR" | "AED" | "AUD";
  amountMinor: number;
  idempotencyKey: string;
};
export type GatewayResult =
  | { configured: false; reason: "provider-not-configured" }
  | {
      configured: true;
      mode: "sandbox";
      checkoutUrl: string;
      providerReference: string;
    };
export interface PaymentGateway {
  readonly mode: "disabled" | "sandbox";
  createCheckout(input: PaymentRequest): Promise<GatewayResult>;
}
export const disabledPaymentGateway: PaymentGateway = {
  mode: "disabled",
  async createCheckout() {
    return { configured: false, reason: "provider-not-configured" };
  },
};
// These currencies have two minor decimal places. Never round a float into a charge.
export function amountToMinorUnits(amount: string, currency: string) {
  if (
    !["LKR", "MVR", "AED", "AUD"].includes(currency) ||
    !/^\d{1,8}(?:\.\d{1,2})?$/.test(amount)
  )
    throw new Error("Invalid supported money amount");
  const [whole, fraction = ""] = amount.split(".");
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("Payment amount must be positive");
  return value;
}
export function assertSandboxRequest(input: PaymentRequest) {
  if (
    !input.businessId ||
    !input.appointmentId ||
    !input.idempotencyKey ||
    !["LKR", "MVR", "AED", "AUD"].includes(input.currency) ||
    !Number.isSafeInteger(input.amountMinor) ||
    input.amountMinor <= 0
  )
    throw new Error("Invalid sandbox payment request");
}
// No public checkout/webhook endpoint exists until durable event deduplication,
// tenant-owned merchant binding and a provider's verified test integration exist.
