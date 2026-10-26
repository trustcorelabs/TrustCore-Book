export type Plan = "FREE" | "PRO";
export type SubscriptionState = { plan: string; state: string; trialEndsAt: Date | null; periodEndsAt: Date | null; graceEndsAt: Date | null };
export const planLimits = { FREE: { services: 5, staff: 2 }, PRO: { services: 100, staff: 20 } } as const;
export function effectivePlan(subscription: SubscriptionState | null, now = new Date()): Plan {
  if (!subscription || subscription.plan !== "PRO") return "FREE";
  if (subscription.state === "TRIALING" && subscription.trialEndsAt && subscription.trialEndsAt > now) return "PRO";
  if (subscription.state === "ACTIVE" && subscription.periodEndsAt && subscription.periodEndsAt > now) return "PRO";
  if (subscription.state === "PAST_DUE" && subscription.graceEndsAt && subscription.graceEndsAt > now) return "PRO";
  return "FREE";
}
export function sandboxBillingEnabled() {
  return process.env.BILLING_SANDBOX_ENABLED === "true" && process.env.VERCEL_ENV !== "production";
}
