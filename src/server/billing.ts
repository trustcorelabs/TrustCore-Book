import "server-only";
import { requireTenant } from "./authorization";
import { readBilling, startSandboxTrial, cancelSandboxTrial } from "./repositories/billing";
import { notificationStatus } from "./repositories/notification-jobs";
import { sandboxBillingEnabled, effectivePlan } from "@/features/billing/policy";
import { rateLimit } from "./rate-limit";
export async function billingData(businessId: string) {
  const scope = await requireTenant(businessId, true);
  if (!sandboxBillingEnabled()) return { scope, enabled: false as const, subscription: null, payments: [], plan: "FREE" as const };
  const [subscription, payments] = await readBilling(scope.context);
  return { scope, enabled: true as const, subscription, payments, plan: effectivePlan(subscription) };
}
export async function changeSandboxTrial(businessId: string, cancel: boolean) {
  if (!sandboxBillingEnabled()) return { error: "Sandbox billing is disabled. No subscription was changed." };
  const scope = await requireTenant(businessId, true);
  try { await rateLimit(`sandbox-trial:${scope.user.id}`, 10, 60); if (cancel) await cancelSandboxTrial(scope.context); else await startSandboxTrial(scope.context); return { success: cancel ? "Sandbox trial cancelled." : "Fourteen-day sandbox trial started. No payment was collected." }; } catch { return { error: "Unable to change this sandbox trial. Trials can be used only once per workspace." }; }
}
export async function notificationData(businessId: string) {
  const scope = await requireTenant(businessId, true);
  return { scope, jobs: await notificationStatus(scope.business.id) };
}
