import { billingData } from "@/server/billing";
import { PageHeading } from "@/components/ui/page-heading";
import { BillingTrial } from "@/components/billing-trial";
import { DataTable } from "@/components/data-table";
import { planLimits } from "@/features/billing/policy";
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params,
    d = await billingData(businessId);
  return (
    <>
      <PageHeading
        title="Plans and billing"
        description="Subscription and payment tools are in test mode. No real payment acceptance is enabled."
      />
      <div className="surface p-6">
        <h2 className="text-xl font-semibold">
          {d.enabled ? `${d.plan} · sandbox` : "Billing is disabled"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Live checkout, merchant onboarding and subscription pricing are not
          configured. Existing workspace functionality is unchanged while
          sandbox billing is off.
        </p>
        {d.enabled && (
          <>
            <p className="mt-4 text-sm">
              Sandbox allowance: {planLimits[d.plan].services} active services
              and {planLimits[d.plan].staff} active staff. Paid access is
              granted only by authenticated provider reconciliation.
            </p>
            {d.subscription?.trialEndsAt && (
              <p className="mt-3 text-sm">
                Trial ends:{" "}
                {d.subscription.trialEndsAt.toISOString().slice(0, 10)}
              </p>
            )}
            <BillingTrial
              businessId={businessId}
              active={d.subscription?.state === "TRIALING"}
              used={d.subscription?.trialUsed ?? false}
            />
          </>
        )}
      </div>
      <div className="mt-6">
        <DataTable
          columns={[
            { key: "state", label: "Test payment status" },
            { key: "currency", label: "Currency" },
            { key: "amount", label: "Expected / paid / refunded" },
          ]}
          rows={d.payments.map((p) => ({
            state: p.state,
            currency: p.currency,
            amount: [p.amountMinor, p.paidMinor, p.refundedMinor]
              .map((n) => (n / 100).toFixed(2))
              .join(" / "),
          }))}
          emptyTitle="No sandbox payments"
          emptyDescription="Redirects do not confirm a payment. There is no live payment gateway connected."
        />
      </div>
    </>
  );
}
export const dynamic = "force-dynamic";
