import { getDashboard, getWorkspace } from "@/server/queries";
import { canManage } from "@/lib/validation";
import { DashboardView } from "@/components/dashboard-view";
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const [data, workspace] = await Promise.all([
    getDashboard(businessId),
    getWorkspace(businessId),
  ]);
  return (
    <DashboardView
      businessId={businessId}
      business={data.business}
      userName={data.user.name}
      manage={canManage(data.member.role)}
      counts={{
        appointments: data.appointments,
        services: data.services,
        staff: data.staff,
        customers: data.customers,
      }}
      recentActivity={data.recentActivity.map((a) => ({
        id: a.id,
        action: a.action,
        actor: a.actor?.name ?? "System",
        createdAt: a.createdAt.toISOString(),
      }))}
      appointments={workspace.appointments}
      configuredStaffCount={
        workspace.staff.filter(
          (person) => person.active && person.availability.length > 0,
        ).length
      }
    />
  );
}
export const dynamic = "force-dynamic";
