import { customerHistory } from "@/server/insights";
import { PageHeading } from "@/components/ui/page-heading";
import { Card } from "@/components/ui/card";
import { AppointmentList } from "@/components/appointment-list";
import { canManage } from "@/lib/validation";
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string; customerId: string }>;
}) {
  const { businessId, customerId } = await params;
  const { scope, customer: c } = await customerHistory(businessId, customerId);
  return (
    <>
      <PageHeading
        title={c.name}
        description="Customer profile and recorded visit history."
      />
      <Card className="mb-6">
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Email</dt>
            <dd className="mt-2">{c.email ?? "Not provided"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Phone</dt>
            <dd className="mt-2">{c.phone ?? "Not provided"}</dd>
          </div>
        </dl>
        <p className="mt-5 text-xs text-muted-foreground">
          Notes and marketing-consent preferences are not stored in this
          version.
        </p>
      </Card>
      {c.appointments.length > 100 && (
        <p className="notice mb-5">Showing the latest 100 visits.</p>
      )}
      <AppointmentList
        businessId={businessId}
        timezone={scope.business.timezone}
        manage={canManage(scope.member.role)}
        appointments={c.appointments.slice(0, 100).map((a) => ({
          ...a,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
          customer: c.name,
          service: a.serviceNameSnapshot ?? a.service.name,
          staff: a.staff.name,
        }))}
      />
    </>
  );
}
export const dynamic = "force-dynamic";
